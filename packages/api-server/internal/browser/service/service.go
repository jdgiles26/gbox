package service

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/playwright-community/playwright-go"
	// Removed uuid, browser imports as they are used in other files

	"github.com/babelcloud/gbox/packages/api-server/config"
	boxSvc "github.com/babelcloud/gbox/packages/api-server/internal/box/service"
)

var (
	ErrBoxNotFound     = fmt.Errorf("box not found")
	ErrContextNotFound = fmt.Errorf("context not found")
	ErrPageNotFound    = fmt.Errorf("page not found")
)

// --- Managed Resource Structs ---

// ManagedContext holds details about a browser context.
type ManagedContext struct {
	ID            string // UUID
	Instance      playwright.BrowserContext
	ParentBrowser *ManagedBrowser         // Reference back to parent browser
	Pages         map[string]*ManagedPage // pageID -> ManagedPage
	ActivePage    *ManagedPage            // Currently active/focused page in this context (can be nil)
	mu            sync.RWMutex            // Mutex for Pages map and ActivePage field
}

// ManagedPage holds details about a page managed by the service.
type ManagedPage struct {
	ID            string // UUID
	Instance      playwright.Page
	ParentContext *ManagedContext // Reference back to parent context
}

// ManagedBrowser holds details about a browser connection managed for a box.
type ManagedBrowser struct {
	BoxID    string
	Instance playwright.Browser
	Contexts map[string]*ManagedContext // contextID -> ManagedContext
	mu       sync.RWMutex               // Mutex for Contexts map
}

// --- Browser Service (Core struct definition) ---

// BrowserService handles the core logic for browser automation using structured management.
type BrowserService struct {
	managedBrowsers map[string]*ManagedBrowser // boxID -> ManagedBrowser
	pageMap         map[string]*ManagedPage    // pageID -> ManagedPage (Global index for fast lookup)
	mu              sync.RWMutex               // Protects managedBrowsers map and pageMap
	boxManager      boxSvc.BoxService
	pw              *playwright.Playwright
}

// NewBrowserService creates a new BrowserService.
func NewBrowserService(boxMgr boxSvc.BoxService) (*BrowserService, error) {
	pw, err := playwright.Run()
	if err != nil {
		return nil, fmt.Errorf("could not start playwright: %w", err)
	}
	return &BrowserService{
		managedBrowsers: make(map[string]*ManagedBrowser),
		pageMap:         make(map[string]*ManagedPage),
		boxManager:      boxMgr,
		pw:              pw,
	}, nil
}

// Close cleans up Playwright instance and all managed browser connections.
func (s *BrowserService) Close() error {
	s.mu.Lock() // Lock the main map
	var closeErrors error
	browsersToClose := make([]playwright.Browser, 0, len(s.managedBrowsers))
	browserIDs := make([]string, 0, len(s.managedBrowsers))

	// Collect browsers to close while holding the lock
	for boxID, mb := range s.managedBrowsers {
		if mb.Instance != nil && mb.Instance.IsConnected() {
			browsersToClose = append(browsersToClose, mb.Instance)
			browserIDs = append(browserIDs, boxID) // Keep track of IDs for logging
		}
	}
	// Clear the maps immediately *before* releasing lock and closing browsers
	s.managedBrowsers = make(map[string]*ManagedBrowser)
	s.pageMap = make(map[string]*ManagedPage)
	s.mu.Unlock() // Release the lock BEFORE closing browsers

	// Close browsers (listeners can now run handleBrowserDisconnect without deadlocking)
	for i, browserInstance := range browsersToClose {
		boxID := browserIDs[i] // Get corresponding ID for logging
		fmt.Printf("INFO: Closing browser instance for box %s during service shutdown\n", boxID)
		if err := browserInstance.Close(); err != nil {
			errMsg := fmt.Errorf("failed closing browser for box %s: %w", boxID, err)
			// Aggregate errors (consider using multierror)
			if closeErrors == nil {
				closeErrors = errMsg
			} else {
				closeErrors = fmt.Errorf("%v; %w", closeErrors, errMsg)
			}
		}
	}

	// Stop the Playwright instance (does not require s.mu)
	// REMOVED: The service should not stop the main Playwright instance
	// as it might be shared or managed externally.
	/*
		if s.pw != nil {
			fmt.Println("INFO: Stopping Playwright instance...")
			if err := s.pw.Stop(); err != nil {
				errMsg := fmt.Errorf("failed to stop playwright: %w", err)
				closeErrors = fmt.Errorf("%v; %w", closeErrors, errMsg)
			}
		}
	*/
	return closeErrors // Consider using multierror package for better error aggregation
}

// getOrCreateManagedBrowser finds or creates the ManagedBrowser struct for a box.
func (s *BrowserService) getOrCreateManagedBrowser(boxID string) (*ManagedBrowser, error) {
	if s.pw == nil {
		return nil, fmt.Errorf("playwright instance is not initialized")
	}

	// --- Check cache first (Read Lock) ---
	s.mu.RLock()
	mb, exists := s.managedBrowsers[boxID]
	s.mu.RUnlock()
	if exists && mb.Instance != nil && mb.Instance.IsConnected() {
		fmt.Printf("DEBUG: Reusing existing connected browser instance for box %s\n", boxID)
		return mb, nil
	}

	// --- Need to connect or reconnect (Full Lock) ---
	s.mu.Lock()
	defer s.mu.Unlock()

	// Double-check cache after acquiring write lock
	mb, exists = s.managedBrowsers[boxID]
	if exists && mb.Instance != nil && mb.Instance.IsConnected() {
		fmt.Printf("DEBUG: Reusing existing connected browser instance for box %s (double check)\n", boxID)
		return mb, nil
	}

	// If entry exists but disconnected, clear its old state first
	if exists {
		fmt.Printf("INFO: Cleaning up disconnected browser state for box %s before reconnecting\n", boxID)
		s.cleanupManagedBrowser_locked(mb) // Ensures old contexts/pages are cleared
	}

	// --- Get Connection Details ---
	// Assuming internal port 3000 needs mapping
	// TODO: Make internal port configurable if needed
	// Get internal port from config instead of hardcoding
	internalPort := config.GetInstance().Browser.InternalPort
	if internalPort <= 0 {
		internalPort = 3000 // Fallback just in case config is invalid
		fmt.Printf("WARN: Invalid internal port configured (%d), falling back to default 3000 for box %s\n", config.GetInstance().Browser.InternalPort, boxID)
	}
	portInt, err := s.boxManager.GetExternalPort(context.Background(), boxID, internalPort)
	if err != nil {
		return nil, fmt.Errorf("ERROR: failed to get external port mapping for internal port %d in box %s: %w", internalPort, boxID, err)
	}
	portStr := strconv.Itoa(portInt)
	// Use configured host, default if empty (e.g., "localhost")
	host := config.GetInstance().Browser.Host
	if host == "" {
		host = "localhost" // Default to localhost if config is empty
		fmt.Printf("WARN: Browser host config is empty, defaulting to 'localhost' for box %s\n", boxID)
	}

	// TODO: Make launch options configurable if needed
	launchOptions := `{"channel":"chromium"}` // Keeping default as chromium
	encodedOptions := url.QueryEscape(launchOptions)
	endpointURL := fmt.Sprintf("ws://%s:%s?launch-options=%s", host, portStr, encodedOptions)
	fmt.Printf("INFO: Preparing to connect to Playwright endpoint: %s for box %s\n", endpointURL, boxID)

	// --- Connection Attempt with Retry Logic ---
	var browserInstance playwright.Browser
	var connectErr error
	maxRetries := 3               // Max number of connection attempts
	retryDelay := 4 * time.Second // Delay between retries

	for attempt := 0; attempt < maxRetries; attempt++ {
		// Check Box status BEFORE each attempt (Crucial!)
		// Use a short timeout for status check context
		statusCtx, cancelStatus := context.WithTimeout(context.Background(), 5*time.Second)
		// *** Use the Get method from the interface ***
		boxInfo, statusErr := s.boxManager.Get(statusCtx, boxID) // Changed to Get
		cancelStatus()                                           // Release context resources promptly

		if statusErr != nil {
			// If we can't even get the status, abort connection attempts
			// Handle specific errors like NotFound if needed
			// if errors.Is(statusErr, boxSvc.ErrNotFound) { ... }
			return nil, fmt.Errorf("failed to get box info for %s before connect attempt %d: %w", boxID, attempt+1, statusErr)
		}
		// *** Access the Status field (assuming it exists and is string) ***
		if boxInfo.Status != "running" { // Use constant if available, e.g., model.BoxStatusRunning
			// Box is not running, no point in trying to connect
			return nil, fmt.Errorf("box %s is not running (status: %s), cannot connect to Playwright", boxID, boxInfo.Status)
		}

		// Attempt the actual connection
		// Set timeout via options, not context
		connectTimeout := float64(15000) // 15 seconds in milliseconds
		browserInstance, connectErr = s.pw.Chromium.Connect(endpointURL, playwright.BrowserTypeConnectOptions{
			Timeout: &connectTimeout,
		})

		if connectErr == nil {
			// Success!
			fmt.Printf("INFO: Successfully connected to Playwright in box %s on attempt %d\n", boxID, attempt+1)
			break // Exit retry loop
		}

		// Connection failed, analyze error for retry eligibility
		errMsg := strings.ToLower(connectErr.Error()) // Lowercase for robust checking
		isRetryableError := strings.Contains(errMsg, "connection refused") ||
			strings.Contains(errMsg, "context deadline exceeded") || // Playwright-go often uses this for timeouts
			strings.Contains(errMsg, "socket hang up") ||
			strings.Contains(errMsg, "websocket: bad handshake") || // Can happen during startup
			strings.Contains(errMsg, "reset by peer") ||
			strings.Contains(errMsg, "network is unreachable") // Less likely but possible transient issue

		if isRetryableError && attempt < maxRetries-1 {
			fmt.Printf("INFO: Connection attempt %d/%d to Playwright in box %s failed (retryable: %v): %v. Retrying in %v...\n",
				attempt+1, maxRetries, boxID, isRetryableError, connectErr, retryDelay)
			time.Sleep(retryDelay)
			continue // Go to next attempt
		} else {
			// Non-retryable error OR last attempt failed
			fmt.Printf("ERROR: Final connection attempt %d/%d to Playwright in box %s failed (retryable: %v): %v. Giving up.\n",
				attempt+1, maxRetries, boxID, isRetryableError, connectErr)
			break // Exit loop, connectErr holds the last error
		}
	}

	// Check final error after the loop
	if connectErr != nil {
		// Optional: Could perform cleanup like handleBrowserDisconnect here if needed,
		// but the caller or subsequent operations might handle it anyway.
		return nil, fmt.Errorf("failed to connect to Playwright in box %s after %d attempts: %w", boxID, maxRetries, connectErr)
	}

	// --- Connection Successful - Create and Store ManagedBrowser ---
	mb = &ManagedBrowser{
		BoxID:    boxID,
		Instance: browserInstance,
		Contexts: make(map[string]*ManagedContext),
		// mu: initialized by make
	}
	s.managedBrowsers[boxID] = mb

	// Setup disconnect handler for the new instance
	browserInstance.Once("disconnected", func() {
		fmt.Printf("INFO: Browser disconnected event for box %s\n", boxID)
		s.handleBrowserDisconnect(boxID) // Use the existing handler
	})

	fmt.Printf("INFO: Managed browser instance created and stored for box %s\n", boxID)
	return mb, nil
}

// GetPageInstance retrieves a specific page instance managed by the service.
func (s *BrowserService) GetPageInstance(boxID, contextID, pageID string) (playwright.Page, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	mb, browserExists := s.managedBrowsers[boxID]
	if !browserExists {
		return nil, fmt.Errorf("%w: browser for box %s not managed", ErrBoxNotFound, boxID)
	}

	mb.mu.RLock()
	defer mb.mu.RUnlock()
	mc, contextExists := mb.Contexts[contextID]
	if !contextExists {
		return nil, fmt.Errorf("%w: context %s not found in box %s", ErrContextNotFound, contextID, boxID)
	}

	// Check the global page map for direct lookup
	mp, pageExists := s.pageMap[pageID]
	if !pageExists || mp.ParentContext != mc { // Ensure page belongs to the correct context
		// Check context-local map as fallback (though pageMap should be canonical)
		mc.mu.RLock()
		mpLocal, pageExistsLocal := mc.Pages[pageID]
		mc.mu.RUnlock()
		if !pageExistsLocal {
			return nil, fmt.Errorf("%w: page %s not found in context %s", ErrPageNotFound, pageID, contextID)
		}
		// If found locally but not globally or wrong context, log inconsistency?
		return mpLocal.Instance, nil
	}

	if mp.Instance == nil { // Should not happen if in map
		return nil, fmt.Errorf("internal error: page %s found but instance is nil", pageID)
	}

	return mp.Instance, nil
}

// cleanupManagedBrowser_locked removes contexts and pages associated with a browser.
// Assumes s.mu is already locked.
func (s *BrowserService) cleanupManagedBrowser_locked(mb *ManagedBrowser) {
	if mb == nil {
		return
	}
	mb.mu.Lock() // Lock the browser's context map
	defer mb.mu.Unlock()

	for contextID, mc := range mb.Contexts {
		s.cleanupManagedContext_locked(mc) // Clean up pages within the context
		// No need to delete from mb.Contexts here, as the whole mb will be removed or reset
		_ = contextID // Avoid unused variable error if contextID isn't used otherwise
	}
	mb.Contexts = make(map[string]*ManagedContext) // Reset context map
}

// handleBrowserDisconnect removes the ManagedBrowser and cleans its resources.
func (s *BrowserService) handleBrowserDisconnect(boxID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	mb, exists := s.managedBrowsers[boxID]
	if !exists {
		return // Already removed or never existed
	}

	s.cleanupManagedBrowser_locked(mb)
	delete(s.managedBrowsers, boxID)
	fmt.Printf("INFO: Removed managed browser entry for box %s after disconnect\n", boxID)
}

// HandleBoxDeletion ensures cleanup when a box is deleted.
func (s *BrowserService) HandleBoxDeletion(boxID string) {
	s.mu.Lock()
	mb, exists := s.managedBrowsers[boxID]
	if !exists {
		s.mu.Unlock()
		return // Nothing to do if browser wasn't managed
	}
	s.cleanupManagedBrowser_locked(mb) // Clean up associated contexts/pages from maps
	delete(s.managedBrowsers, boxID)   // Remove browser entry
	s.mu.Unlock()

	if mb.Instance != nil && mb.Instance.IsConnected() {
		fmt.Printf("INFO: Closing browser for deleted box %s\n", boxID)
		if err := mb.Instance.Close(); err != nil {
			fmt.Printf("WARN: Error closing browser for deleted box %s: %v\n", boxID, err)
		}
	} else {
		fmt.Printf("INFO: No active browser found or already disconnected for deleted box %s\n", boxID)
	}
}

// GetCdpURL returns the Chrome DevTools Protocol URL for a given box.
// This allows external clients (like Playwright's connectOverCDP) to directly control the browser.
func (s *BrowserService) GetCdpURL(boxID string) (string, error) {
	// The internal port inside the gbox container where chromium is listening for CDP connections.
	const internalCdpPort = 9222

	// Use a background context for the port lookup.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get the external port mapping from the box manager.
	externalPort, err := s.boxManager.GetExternalPort(ctx, boxID, internalCdpPort)
	if err != nil {
		return "", fmt.Errorf("failed to get external port for CDP on box %s: %w", boxID, err)
	}

	// Get the host from the configuration.
	host := config.GetInstance().Browser.Host
	if host == "" {
		host = "localhost" // Default to localhost if not configured
	}

	// Construct the final CDP URL.
	cdpURL := fmt.Sprintf("ws://%s:%d", host, externalPort)
	fmt.Printf("INFO: Constructed CDP URL for box %s: %s\n", boxID, cdpURL)

	return cdpURL, nil
}

// --- Methods below are now implemented in separate files (context.go, page.go, page_action.go) ---
