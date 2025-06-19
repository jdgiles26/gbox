package service

import (
	"context"
	"fmt"
	"time"

	"github.com/babelcloud/gbox/packages/api-server/config"
	boxSvc "github.com/babelcloud/gbox/packages/api-server/internal/box/service"
)

var (
	ErrBoxNotFound = fmt.Errorf("box not found")
)

// BrowserService handles the core logic for browser automation.
type BrowserService struct {
	boxManager boxSvc.BoxService
}

// NewBrowserService creates a new BrowserService.
func NewBrowserService(boxMgr boxSvc.BoxService) (*BrowserService, error) {
	return &BrowserService{
		boxManager: boxMgr,
	}, nil
}

// Close cleans up the service.
func (s *BrowserService) Close() error {
	return nil
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
	cdpURL := fmt.Sprintf("http://%s:%d", host, externalPort)
	fmt.Printf("INFO: Constructed CDP URL for box %s: %s\n", boxID, cdpURL)

	return cdpURL, nil
}

// --- Methods below are now implemented in separate files (context.go, page.go, page_action.go) ---
