package cmd

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// Test data
const mockBoxStopSuccessResponse = `{"success":true,"message":"Box stopped successfully"}`

// TestBoxStopSuccess tests successfully stopping a box
// TestBoxStopSuccess tests successfully stopping a box
func TestBoxStopSuccess(t *testing.T) {
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintln(w, `{"boxes":[{"id":"test-box-id"}]}`)
			return
		}
		if r.Method == "POST" && r.URL.Path == "/api/v1/boxes/test-box-id/stop" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(mockBoxStopSuccessResponse))
			return
		}
		http.Error(w, fmt.Sprintf("Mock server: Route not found for %s %s", r.Method, r.URL.Path), http.StatusNotFound)
	}))
	defer server.Close()

	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)
	os.Setenv("API_ENDPOINT", server.URL)

	rPipe, wPipe, _ := os.Pipe()
	os.Stdout = wPipe
	os.Stderr = wPipe

	cmd := NewBoxStopCommand()
	cmd.SetArgs([]string{"test-box-id"})
	err := cmd.Execute()
	assert.NoError(t, err, "cmd.Execute() should not return an error for successful stop")

	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// fmt.Fprintf(oldStdout, "Captured output for TestBoxStopSuccess: %s\n", output)
	assert.Contains(t, output, "Box stopped successfully", "Output message mismatch")
}

// TestBoxStopWithJsonOutput tests stopping a box with JSON output format
// TestBoxStopWithJsonOutput tests stopping a box with JSON output format
func TestBoxStopWithJsonOutput(t *testing.T) {
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintln(w, `{"boxes":[{"id":"test-box-id"}]}`)
			return
		}
		if r.Method == "POST" && r.URL.Path == "/api/v1/boxes/test-box-id/stop" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(mockBoxStopSuccessResponse))
			return
		}
		http.Error(w, fmt.Sprintf("Mock server: Route not found for %s %s", r.Method, r.URL.Path), http.StatusNotFound)
	}))
	defer server.Close()

	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)
	os.Setenv("API_ENDPOINT", server.URL)

	rPipe, wPipe, _ := os.Pipe()
	os.Stdout = wPipe
	os.Stderr = wPipe

	cmd := NewBoxStopCommand()
	cmd.SetArgs([]string{"test-box-id", "--output", "json"})
	err := cmd.Execute()
	assert.NoError(t, err, "cmd.Execute() should not return an error for successful stop with JSON")

	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// fmt.Fprintf(oldStdout, "Captured JSON output for TestBoxStopWithJsonOutput: %s\n", output)
	assert.JSONEq(t, mockBoxStopSuccessResponse, strings.TrimSpace(output), "JSON output mismatch")
}

// TestBoxStopNotFound tests the case when box is not found
// TestBoxStopNotFound tests the case when box ID prefix does not match any box
func TestBoxStopNotFound(t *testing.T) {
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintln(w, `{"boxes":[]}`) // No boxes match the prefix
			return
		}
		// This path should ideally not be hit if ResolveBoxIDPrefix fails first
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound) // Default to 404 if specific /stop URL is somehow hit
		w.Write([]byte(`{"error": "Box not found by direct API call for /stop"}`))
	}))
	defer server.Close()

	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)
	os.Setenv("API_ENDPOINT", server.URL)

	rPipe, wPipe, _ := os.Pipe()
	os.Stdout = wPipe // Capture stdout/stderr to check messages if needed, though error is primary
	os.Stderr = wPipe

	cmd := NewBoxStopCommand()
	cmd.SetArgs([]string{"non-existent-box-prefix"})
	err := cmd.Execute() // Should return error from ResolveBoxIDPrefix

	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	// output := buf.String()
	// fmt.Fprintf(oldStdout, "Captured output for TestBoxStopNotFound: %s\n", output)
	// if err != nil {
	// 	fmt.Fprintf(oldStdout, "Error from cmd.Execute() for TestBoxStopNotFound: %v\n", err)
	// }
	
	assert.Error(t, err, "cmd.Execute() should return an error when box ID prefix is not found")
	if err != nil {
		assert.Contains(t, err.Error(), "failed to resolve box ID:", "Error message should indicate resolution failure")
		assert.Contains(t, err.Error(), "no box found with ID prefix: non-existent-box-prefix", "Error message mismatch for not found")
	}
}
// TestBoxStopServerError tests the case of a server error
// TestBoxStopServerError tests the case of a server error during stop
func TestBoxStopServerError(t *testing.T) {
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	boxIDToTest := "server-error-box-id"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"boxes":[{"id":"%s"}]}`, boxIDToTest)
			return
		}
		if r.Method == "POST" && r.URL.Path == fmt.Sprintf("/api/v1/boxes/%s/stop", boxIDToTest) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError) // 500 server error
			w.Write([]byte(`{"error": "Internal server error"}`))
			return
		}
		http.Error(w, fmt.Sprintf("Mock server: Route not found for %s %s", r.Method, r.URL.Path), http.StatusNotFound)
	}))
	defer server.Close()

	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)
	os.Setenv("API_ENDPOINT", server.URL)

	rPipe, wPipe, _ := os.Pipe()
	os.Stdout = wPipe
	os.Stderr = wPipe

	cmd := NewBoxStopCommand()
	cmd.SetArgs([]string{boxIDToTest})
	err := cmd.Execute()
	// handleStopResponse prints the error message and returns nil for HTTP errors other than 404.
	assert.NoError(t, err, "cmd.Execute() should not return an error for server error scenario as it's handled")

	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// fmt.Fprintf(oldStdout, "Captured output for TestBoxStopServerError: %s\n", output)
	assert.Contains(t, output, "Error: Failed to stop box (HTTP 500)", "Output message mismatch for server error")
}

// TestBoxStopHelp tests help information
func TestBoxStopHelp(t *testing.T) {
	// Save original stdout and stderr for later restoration
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	// Create pipe to capture stdout
	r, w, _ := os.Pipe()
	os.Stdout = w
	os.Stderr = w

	// Execute command
	cmd := NewBoxStopCommand()
	cmd.SetArgs([]string{"--help"})
	err := cmd.Execute()
	assert.NoError(t, err)

	// Read captured output
	w.Close()
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	fmt.Fprintf(oldStdout, "Captured output: %s\n", output)

	// Check if help message contains key sections
	assert.Contains(t, output, "Usage:")
	assert.Contains(t, output, "stop [box-id]")
	assert.Contains(t, output, "Stop a running box")
	assert.Contains(t, output, "--output")
	assert.Contains(t, output, "json or text")
	assert.Contains(t, output, "gbox box stop")
}
