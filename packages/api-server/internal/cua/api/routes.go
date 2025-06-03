package api

import (
	"github.com/emicklei/go-restful/v3"
)

// CuaExecuteParams represents the parameters for CUA execute request
type CuaExecuteParams struct {
	OpenAIAPIKey string `json:"openai_api_key" description:"OpenAI API key for computer use"`
	Task         string `json:"task" description:"Task description for the AI to execute"`
}

// CuaError represents an error response from CUA API
type CuaError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// RegisterCuaRoutes registers all CUA-related routes to the WebService
func RegisterCuaRoutes(ws *restful.WebService, cuaHandler *CuaHandler) {
	// CUA Execute Operation
	ws.Route(ws.POST("/cua/execute").To(cuaHandler.ExecuteTask).
		Doc("execute a task using computer use agent").
		Reads(CuaExecuteParams{}).
		Produces("text/event-stream", "application/json").
		Returns(200, "OK", "SSE stream with execution progress").
		Returns(400, "Bad Request", CuaError{}).
		Returns(500, "Internal Server Error", CuaError{}))
} 