package api

import (
	"net/http"

	"github.com/emicklei/go-restful/v3"
)

// RegisterBrowserRoutes adds the browser API routes to the web service.
func RegisterBrowserRoutes(ws *restful.WebService, handler *Handler) {

	// --- CDP Connection Routes ---

	ws.Route(ws.GET("/boxes/{id}/browser/connect-url/cdp").To(handler.GetCdpURL).
		Doc("Get CDP URL for browser connection").
		Param(ws.PathParameter("id", "identifier of the box").DataType("string")).
		Returns(http.StatusOK, "CDP URL as plain text", "").
		Returns(http.StatusBadRequest, "Bad Request", nil).
		Returns(http.StatusNotFound, "Not Found", nil).
		Returns(http.StatusInternalServerError, "Internal Server Error", nil))
}
