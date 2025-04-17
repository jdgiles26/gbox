package config

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
)

var v *viper.Viper

func init() {
	v = viper.New()

	// Set default values
	v.SetDefault("api.endpoint", "http://localhost:28080")
	v.SetDefault("project.root", "")
	v.SetDefault("mcp.server.url", "http://localhost:28090    pengyop peng/sse") // Default MCP server URL

	// Environment variables
	v.AutomaticEnv()
	v.BindEnv("api.endpoint", "API_ENDPOINT")
	v.BindEnv("project.root", "PROJECT_ROOT")
	v.BindEnv("mcp.server.url", "MCP_SERVER_URL") // Bind MCP server URL env var

	// Config file
	v.SetConfigName("config")
	v.SetConfigType("yaml")

	// Look for config in the following paths
	configPaths := []string{
		".",
		"$HOME/.gbox",
		"/etc/gbox",
	}

	for _, path := range configPaths {
		expandedPath := os.ExpandEnv(path)
		v.AddConfigPath(expandedPath)
	}

	// Read config file if it exists
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			// Config file was found but another error was produced
			panic(fmt.Sprintf("Fatal error reading config file: %s", err))
		}
		// Config file not found; ignore error and use defaults
	}
}

// GetAPIURL returns the API server URL
func GetAPIURL() string {
	return v.GetString("api.endpoint")
}

// GetProjectRoot returns the project root directory
func GetProjectRoot() string {
	return v.GetString("project.root")
}

// GetMcpServerUrl returns the MCP server URL
func GetMcpServerUrl() string {
	return v.GetString("mcp.server.url")
}
