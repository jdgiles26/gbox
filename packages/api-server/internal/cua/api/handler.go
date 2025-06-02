package api

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/babelcloud/gbox/packages/api-server/config"
	"github.com/babelcloud/gbox/packages/api-server/pkg/logger"
	"github.com/emicklei/go-restful/v3"
)

var cuaLog = logger.New()

// CuaHandler handles HTTP requests for CUA operations
type CuaHandler struct{}

// NewCuaHandler creates a new CuaHandler
func NewCuaHandler() *CuaHandler {
	return &CuaHandler{}
}

// ExecuteTask executes a task using computer use agent
func (h *CuaHandler) ExecuteTask(req *restful.Request, resp *restful.Response) {
	// Set SSE headers
	resp.Header().Set("Content-Type", "text/event-stream")
	resp.Header().Set("Cache-Control", "no-cache")
	resp.Header().Set("Connection", "keep-alive")
	resp.Header().Set("Access-Control-Allow-Origin", "*")
	resp.Header().Set("Access-Control-Allow-Headers", "Cache-Control")
	resp.Header().Set("X-Accel-Buffering", "no") // Disable proxy buffering
	resp.WriteHeader(http.StatusOK)

	// Read request body
	var executeParams CuaExecuteParams
	if err := req.ReadEntity(&executeParams); err != nil {
		h.sendSSEError(resp, "InvalidRequest", fmt.Sprintf("Failed to parse request body: %v", err))
		return
	}

	// Validate required parameters
	if executeParams.OpenAIAPIKey == "" || executeParams.Task == "" {
		h.sendSSEError(resp, "MissingParameters", "Both openai_api_key and task are required")
		return
	}

	// Get CUA server configuration
	cfg := config.GetInstance()
	cuaHost := cfg.Cua.Host
	cuaPort := cfg.Cua.Port

	if cuaHost == "" || cuaPort == 0 {
		h.sendSSEError(resp, "ConfigurationError", "CUA server host or port not configured")
		return
	}

	// Prepare request to main.ts
	cuaURL := fmt.Sprintf("http://%s:%d/execute", cuaHost, cuaPort)

	// Convert request to JSON
	requestBody, err := json.Marshal(executeParams)
	if err != nil {
		h.sendSSEError(resp, "MarshalError", fmt.Sprintf("Failed to marshal request: %v", err))
		return
	}

	// Create HTTP request to CUA server
	cuaReq, err := http.NewRequestWithContext(req.Request.Context(), "POST", cuaURL, bytes.NewBuffer(requestBody))
	if err != nil {
		h.sendSSEError(resp, "RequestCreationError", fmt.Sprintf("Failed to create CUA request: %v", err))
		return
	}

	cuaReq.Header.Set("Content-Type", "application/json")
	cuaReq.Header.Set("Accept", "text/event-stream")
	cuaReq.Header.Set("Connection", "keep-alive")
	cuaReq.Header.Set("Cache-Control", "no-cache")

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * time.Minute, // Long timeout for AI operations
		Transport: &http.Transport{
			DisableCompression: true, // Disable compression for real-time streaming
		},
	}

	// Send request to CUA server
	cuaResp, err := client.Do(cuaReq)
	if err != nil {
		h.sendSSEError(resp, "CuaConnectionError", fmt.Sprintf("Failed to connect to CUA server: %v", err))
		return
	}
	defer cuaResp.Body.Close()

	// Check response status
	if cuaResp.StatusCode != http.StatusOK {
		// Read error response
		errorBody, _ := io.ReadAll(cuaResp.Body)
		h.sendSSEError(resp, "CuaServerError", fmt.Sprintf("CUA server returned status %d: %s", cuaResp.StatusCode, string(errorBody)))
		return
	}

	// Stream response from CUA server to client
	h.streamCuaResponse(resp, cuaResp.Body)
}

// streamCuaResponse streams the SSE response from CUA server to client
func (h *CuaHandler) streamCuaResponse(resp *restful.Response, cuaRespBody io.ReadCloser) {
	defer cuaRespBody.Close()

	scanner := bufio.NewScanner(cuaRespBody)

	// Set a larger buffer size for SSE messages
	const maxTokenSize = 1024 * 1024 // 1MB
	buf := make([]byte, maxTokenSize)
	scanner.Buffer(buf, maxTokenSize)

	for scanner.Scan() {
		line := scanner.Text()

		// Forward ALL lines including empty ones to maintain SSE format
		// Empty lines are crucial for SSE event separation
		_, err := fmt.Fprintf(resp.ResponseWriter, "%s\n", line)
		if err != nil {
			cuaLog.Errorf("Failed to write SSE line to client: %v", err)
			return
		}

		// Flush the response immediately for real-time streaming
		if flusher, ok := resp.ResponseWriter.(http.Flusher); ok {
			flusher.Flush()
		}
	}

	if err := scanner.Err(); err != nil {
		cuaLog.Infof("Error reading CUA response stream: %v", err)
		h.sendSSEError(resp, "StreamError", fmt.Sprintf("Error reading CUA response: %v", err))
	}
}

// sendSSEError sends an error message via SSE
func (h *CuaHandler) sendSSEError(resp *restful.Response, code, message string) {
	errorData := CuaError{
		Code:    code,
		Message: message,
	}

	errorJSON, err := json.Marshal(errorData)
	if err != nil {
		cuaLog.Errorf("Failed to marshal error: %v", err)
		// Send a simple error message if JSON marshal fails
		fmt.Fprintf(resp.ResponseWriter, "data: {\"error\":\"Internal error occurred\"}\n\n")
	} else {
		fmt.Fprintf(resp.ResponseWriter, "data: %s\n\n", string(errorJSON))
	}

	if flusher, ok := resp.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}

	cuaLog.Infof("CUA API Error - Code: %s, Message: %s", code, message)
}
