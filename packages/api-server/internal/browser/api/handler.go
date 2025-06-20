package api

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/emicklei/go-restful/v3"

	browserSvc "github.com/babelcloud/gbox/packages/api-server/internal/browser/service"
)

// Handler wraps the browser service to expose it via API endpoints.
type Handler struct {
	service *browserSvc.BrowserService
}

// NewHandler creates a new API handler for the browser service.
func NewHandler(svc *browserSvc.BrowserService) *Handler {
	if svc == nil {
		panic("BrowserService cannot be nil") // Or return an error
	}
	return &Handler{
		service: svc,
	}
}

// writeError is a helper to write standard error responses.
func writeError(resp *restful.Response, statusCode int, err error) {
	resp.WriteHeader(statusCode)
	_ = resp.WriteError(statusCode, err)
	// Log the error server-side as well?
	fmt.Printf("API Error (%d): %v\n", statusCode, err)
}

// --- CDP Connection Handlers ---

// GetCdpURL handles GET /boxes/{id}/browser/connect-url/cdp
func (h *Handler) GetCdpURL(req *restful.Request, resp *restful.Response) {
	boxID := req.PathParameter("id")
	if boxID == "" {
		writeError(resp, http.StatusBadRequest, fmt.Errorf("box ID is required"))
		return
	}

	cdpURL, err := h.service.GetCdpURL(boxID)
	if err != nil {
		if errors.Is(err, browserSvc.ErrBoxNotFound) {
			writeError(resp, http.StatusNotFound, err)
		} else {
			writeError(resp, http.StatusInternalServerError, fmt.Errorf("failed to get CDP URL: %w", err))
		}
		return
	}

	resp.WriteHeader(http.StatusOK)
	resp.Header().Set("Content-Type", "text/plain")
	_, _ = resp.Write([]byte(cdpURL))
}
