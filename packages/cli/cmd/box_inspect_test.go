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
const mockBoxInspectResponse = `{
	"id": "test-box-id",
	"image": "ubuntu:latest",
	"status": "running",
	"created": "2023-05-01T12:00:00Z",
	"ports": [{"host": 8080, "container": 80}],
	"env": {"DEBUG": "true", "ENV": "test"}
}`

// TestBoxInspect tests getting box details
// TestBoxInspect tests getting box details
func TestBoxInspect(t *testing.T) {
	// Save original stdout and stderr for later restoration
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle GET /api/v1/boxes for ResolveBoxIDPrefix
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintln(w, `{"boxes":[{"id":"test-box-id"}]}`) // Provide the ID to be resolved
			return
		}

		// Handle GET /api/v1/boxes/test-box-id for the actual inspect call
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes/test-box-id" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(mockBoxInspectResponse))
			return
		}
		http.Error(w, fmt.Sprintf("Mock server: Route not found for %s %s", r.Method, r.URL.Path), http.StatusNotFound)
	}))
	defer server.Close()

	// Save original environment variables (simplified)
	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)
	os.Setenv("API_ENDPOINT", server.URL) // Set API URL to mock server

	// Create pipe to capture stdout and stderr
	rPipe, wPipe, _ := os.Pipe()
	os.Stdout = wPipe
	os.Stderr = wPipe

	// Execute command
	cmd := NewBoxInspectCommand()
	cmd.SetArgs([]string{"test-box-id"}) // This prefix will be resolved
	err := cmd.Execute()
	assert.NoError(t, err, "cmd.Execute() should not return an error for successful inspect")

	// Read captured output
	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// fmt.Fprintf(oldStdout, "Captured output for TestBoxInspect: %s\n", output) // For debugging

	// Check output
	assert.Contains(t, output, "Box details:", "Output should contain 'Box details:'")
	assert.Contains(t, output, "id", "Output should contain 'id'")
	assert.Contains(t, output, "test-box-id", "Output should contain 'test-box-id'")
	assert.Contains(t, output, "image", "Output should contain 'image'")
	assert.Contains(t, output, "ubuntu:latest", "Output should contain 'ubuntu:latest'")
	assert.Contains(t, output, "status", "Output should contain 'status'")
	assert.Contains(t, output, "running", "Output should contain 'running'")
}
// TestBoxInspectWithJsonOutput tests getting box details in JSON format
// TestBoxInspectWithJsonOutput tests getting box details in JSON format
func TestBoxInspectWithJsonOutput(t *testing.T) {
	// Save original stdout and stderr
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintln(w, `{"boxes":[{"id":"test-box-id"}]}`)
			return
		}
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes/test-box-id" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(mockBoxInspectResponse))
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

	cmd := NewBoxInspectCommand()
	cmd.SetArgs([]string{"test-box-id", "--output", "json"})
	err := cmd.Execute()
	assert.NoError(t, err, "cmd.Execute() should not return an error for successful inspect with JSON")

	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// fmt.Fprintf(oldStdout, "Captured JSON output for TestBoxInspectWithJsonOutput: %s\n", output) // For debugging
	assert.JSONEq(t, mockBoxInspectResponse, strings.TrimSpace(output), "JSON output mismatch")
}

// TestBoxInspectNotFound tests the case when box does not exist
// TestBoxInspectNotFound tests the case when box ID prefix does not match any box
func TestBoxInspectNotFound(t *testing.T) {
	// Save original stdout and stderr
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	// Create mock server that returns an empty list of boxes for /api/v1/boxes
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintln(w, `{"boxes":[]}`) // No boxes match
			return
		}
		// If ResolveBoxIDPrefix somehow passes (e.g. empty prefix was allowed and returned error later),
		// or if a direct call to /api/v1/boxes/<id> happens, this would be the response.
		// However, with `ResolveBoxIDPrefix`, this specific path for a non-existent ID shouldn't be hit if prefix resolution fails first.
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error": "Box not found by direct API call"}`))
	}))
	defer server.Close()

	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)
	os.Setenv("API_ENDPOINT", server.URL)

	// Capture stderr, as the error message from cmd.Execute() will be the primary output
	rPipe, wPipe, _ := os.Pipe()
	// os.Stdout = wPipe // Not strictly needed as error is returned by Execute
	os.Stderr = wPipe // User-friendly errors from ResolveBoxIDPrefix go to returned error, not stdout/stderr directly from it

	cmd := NewBoxInspectCommand()
	cmd.SetArgs([]string{"non-existent-box-prefix"}) // This prefix should not match
	
	err := cmd.Execute() // This should now return an error

	wPipe.Close() // Close writer
	var errOutputBuf bytes.Buffer // To capture anything written to Stderr by cobra/cmd itself, though our errors are direct returns
	io.Copy(&errOutputBuf, rPipe)

	// fmt.Fprintf(oldStdout, "Captured output for TestBoxInspectNotFound (stderr): %s\n", errOutputBuf.String())
	// if err != nil {
	// 	fmt.Fprintf(oldStdout, "Error from cmd.Execute() for TestBoxInspectNotFound: %v\n", err)
	// }

	assert.Error(t, err, "cmd.Execute() should return an error when box ID prefix is not found")
	if err != nil { // Check err is not nil before asserting its content
		assert.Contains(t, err.Error(), "failed to resolve box ID:", "Error message should indicate resolution failure")
		assert.Contains(t, err.Error(), "no box found with ID prefix: non-existent-box-prefix", "Error message mismatch for not found")
	}
}
// TestBoxInspectHelp tests help information
func TestBoxInspectHelp(t *testing.T) {
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
	cmd := NewBoxInspectCommand()
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
	assert.Contains(t, output, "inspect [box-id]")
	assert.Contains(t, output, "Get detailed information about a box")
	assert.Contains(t, output, "--output")
	assert.Contains(t, output, "Output format (json or text)")
	assert.Contains(t, output, "--help")
	assert.Contains(t, output, "gbox box inspect 550e8400")
}
