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
const mockBoxStartSuccessResponse = `{"message":"Box started successfully"}`
const mockBoxStartAlreadyRunningResponse = `{"error":"Box is already running"}`
const mockBoxStartInvalidRequestResponse = `{"error":"Invalid request"}`

// TestBoxStartSuccess tests successfully starting a box
// TestBoxStartSuccess tests successfully starting a box
func TestBoxStartSuccess(t *testing.T) {
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
		if r.Method == "POST" && r.URL.Path == "/api/v1/boxes/test-box-id/start" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(mockBoxStartSuccessResponse))
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

	cmd := NewBoxStartCommand()
	cmd.SetArgs([]string{"test-box-id"})
	err := cmd.Execute()
	assert.NoError(t, err, "cmd.Execute() should not return an error for successful start")

	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// fmt.Fprintf(oldStdout, "Captured output for TestBoxStartSuccess: %s\n", output)
	assert.Contains(t, output, "Box started successfully", "Output message mismatch")
}

// TestBoxStartWithJsonOutput tests starting a box with JSON output format
// TestBoxStartWithJsonOutput tests starting a box with JSON output format
func TestBoxStartWithJsonOutput(t *testing.T) {
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
		if r.Method == "POST" && r.URL.Path == "/api/v1/boxes/test-box-id/start" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(mockBoxStartSuccessResponse))
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

	cmd := NewBoxStartCommand()
	cmd.SetArgs([]string{"test-box-id", "--output", "json"})
	err := cmd.Execute()
	assert.NoError(t, err, "cmd.Execute() should not return an error for successful start with JSON")

	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// fmt.Fprintf(oldStdout, "Captured JSON output for TestBoxStartWithJsonOutput: %s\n", output)
	assert.JSONEq(t, mockBoxStartSuccessResponse, strings.TrimSpace(output), "JSON output mismatch")
}

// TestBoxStartNotFound tests the case when box is not found
// TestBoxStartNotFound tests the case when box ID prefix does not match any box
func TestBoxStartNotFound(t *testing.T) {
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
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error": "Box not found by direct API call for /start"}`))
	}))
	defer server.Close()

	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)
	os.Setenv("API_ENDPOINT", server.URL)

	rPipe, wPipe, _ := os.Pipe() // Capture stderr or stdout
	os.Stdout = wPipe
	os.Stderr = wPipe


	cmd := NewBoxStartCommand()
	cmd.SetArgs([]string{"non-existent-box-prefix"})
	err := cmd.Execute() // Should return error from ResolveBoxIDPrefix

	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe) // Read anything written to stdout/stderr by cobra
	// output := buf.String()
	// fmt.Fprintf(oldStdout, "Captured output for TestBoxStartNotFound: %s\n", output)
	// if err != nil {
	// 	fmt.Fprintf(oldStdout, "Error from cmd.Execute() for TestBoxStartNotFound: %v\n", err)
	// }

	assert.Error(t, err, "cmd.Execute() should return an error when box ID prefix is not found")
	if err != nil {
		assert.Contains(t, err.Error(), "failed to resolve box ID:", "Error message should indicate resolution failure")
		assert.Contains(t, err.Error(), "no box found with ID prefix: non-existent-box-prefix", "Error message mismatch for not found")
	}
}

// TestBoxStartAlreadyRunning tests the case when box is already running
// TestBoxStartAlreadyRunning tests the case when box is already running
func TestBoxStartAlreadyRunning(t *testing.T) {
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	boxIDToTest := "already-running-box-id"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"boxes":[{"id":"%s"}]}`, boxIDToTest)
			return
		}
		if r.Method == "POST" && r.URL.Path == fmt.Sprintf("/api/v1/boxes/%s/start", boxIDToTest) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest) // 400 for already running
			w.Write([]byte(mockBoxStartAlreadyRunningResponse))
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

	cmd := NewBoxStartCommand()
	cmd.SetArgs([]string{boxIDToTest})
	err := cmd.Execute()
	// The command itself prints the "Box is already running" message and returns nil for this specific case.
	assert.NoError(t, err, "cmd.Execute() should not return an error for 'already running' scenario as it's handled")

	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// fmt.Fprintf(oldStdout, "Captured output for TestBoxStartAlreadyRunning: %s\n", output)
	assert.Contains(t, output, "Box is already running", "Output message mismatch for already running")
}

// TestBoxStartInvalidRequest tests the case of an invalid request
// TestBoxStartInvalidRequest tests the case of an invalid request
func TestBoxStartInvalidRequest(t *testing.T) {
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	boxIDToTest := "invalid-request-box-id"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"boxes":[{"id":"%s"}]}`, boxIDToTest)
			return
		}
		if r.Method == "POST" && r.URL.Path == fmt.Sprintf("/api/v1/boxes/%s/start", boxIDToTest) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(mockBoxStartInvalidRequestResponse)) // Contains `{"error":"Invalid request"}`
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

	cmd := NewBoxStartCommand()
	cmd.SetArgs([]string{boxIDToTest})
	err := cmd.Execute()
	// The command prints "Error: Invalid request..." and returns nil for this specific 400 error.
	assert.NoError(t, err, "cmd.Execute() should not return an error for 'invalid request' as it's handled")

	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// fmt.Fprintf(oldStdout, "Captured output for TestBoxStartInvalidRequest: %s\n", output)
	assert.Contains(t, output, "Error: Invalid request", "Output message mismatch for invalid request")
	// Check that it doesn't say "already running"
	assert.NotContains(t, output, "already running", "Output should not say already running for a generic invalid request")
}
func TestBoxStartHelp(t *testing.T) {
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
	cmd := NewBoxStartCommand()
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
	assert.Contains(t, output, "start [box-id]")
	assert.Contains(t, output, "Start a stopped box")
	assert.Contains(t, output, "--output")
	assert.Contains(t, output, "json or text")
	assert.Contains(t, output, "gbox box start")
}
