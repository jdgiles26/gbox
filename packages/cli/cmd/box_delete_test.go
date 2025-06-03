package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// Mock responses
const mockDeleteResponse = `{"status":"success"}`
const mockListResponse = `{"boxes":[{"id":"box-1"},{"id":"box-2"}]}`
const mockEmptyListResponse = `{"boxes":[]}`

// TestDeleteSingleBox tests deleting a single box
// TestDeleteSingleBox tests deleting a single box
func TestDeleteSingleBox(t *testing.T) {
	// Save original stdout and stderr for later restoration
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	// Create mock server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle GET /api/v1/boxes for ResolveBoxIDPrefix
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			// Return a list containing the "test-box-id"
			// Ensure this JSON is what ResolveBoxIDPrefix expects (e.g., {"boxes":[{"id":"test-box-id"}]})
			fmt.Fprintln(w, `{"boxes":[{"id":"test-box-id"}]}`)
			return
		}

		// Handle DELETE /api/v1/boxes/test-box-id for the actual delete call
		if r.Method == "DELETE" && r.URL.Path == "/api/v1/boxes/test-box-id" {
			// Check request content for the delete call
			body, err := io.ReadAll(r.Body)
			assert.NoError(t, err, "Failed to read body for delete")
			defer r.Body.Close() // Ensure body is closed

			var req map[string]interface{}
			err = json.Unmarshal(body, &req)
			assert.NoError(t, err, "Failed to unmarshal body for delete")
			// In performBoxDeletion, force is hardcoded to true in the request body.
			assert.Equal(t, true, req["force"], "Request body for delete should have force:true")

			// Return success response for the delete call
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK) // Or http.StatusNoContent (204)
			w.Write([]byte(mockDeleteResponse)) // This response content is mostly for consistency
			return
		}
		
		// If no routes match, return 404 to help debugging
		// This helps identify if the test is calling an unexpected URL
		http.Error(w, fmt.Sprintf("Mock server: Route not found for %s %s", r.Method, r.URL.Path), http.StatusNotFound)
	}))
	defer mockServer.Close()

	// Save original environment variables
	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)

	// Set API URL to mock server
	os.Setenv("API_ENDPOINT", mockServer.URL)

	// Create pipe to capture stdout and stderr
	rPipe, wPipe, _ := os.Pipe()
	os.Stdout = wPipe
	os.Stderr = wPipe // Capture stderr as our ResolveBoxIDPrefix might write debug info there

	// Execute command with "test-box-id" which should be resolved
	cmd := NewBoxDeleteCommand()
	cmd.SetArgs([]string{
		"test-box-id", // This will be resolved by ResolveBoxIDPrefix
		// No --force flag here, as single delete doesn't use it for confirmation.
		// The actual "force:true" is sent in the body by performBoxDeletion.
	})
	err := cmd.Execute()
	assert.NoError(t, err, "cmd.Execute() should not return an error for successful delete")

	// Read captured output
	wPipe.Close() // Close the writer to signal EOF to the reader
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// For debugging the test itself:
	// fmt.Fprintf(oldStdout, "Captured output for TestDeleteSingleBox: %s\n", output)
	// if err != nil {
	//     fmt.Fprintf(oldStdout, "Error from cmd.Execute(): %v\n", err)
	// }


	// Check output
	// The deleteBox function now prints "Box <resolvedBoxID> deleted successfully"
	assert.Contains(t, output, "Box test-box-id deleted successfully", "Output message mismatch")
}

// TestDeleteAllBoxes tests deleting all boxes
func TestDeleteAllBoxes(t *testing.T) {
	// Save original stdout and stderr for later restoration
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	// Create mock server
	var requestCount int
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++

		// First request should be to list all boxes
		if requestCount == 1 {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/boxes", r.URL.Path)

			// Return box list
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(mockListResponse))
			return
		}

		// Subsequent requests should be to delete individual boxes
		assert.Equal(t, "DELETE", r.Method)
		assert.True(t, strings.HasPrefix(r.URL.Path, "/api/v1/boxes/box-"))

		// Check request content
		body, err := io.ReadAll(r.Body)
		assert.NoError(t, err)
		defer r.Body.Close()

		var req map[string]interface{}
		err = json.Unmarshal(body, &req)
		assert.NoError(t, err)
		assert.Equal(t, true, req["force"])

		// Return success response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(mockDeleteResponse))
	}))
	defer mockServer.Close()

	// Save original environment variables
	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)

	// Set API URL to mock server
	os.Setenv("API_ENDPOINT", mockServer.URL)

	// Create pipe to capture stdout
	r, w, _ := os.Pipe()
	os.Stdout = w
	os.Stderr = w

	// Execute command
	cmd := NewBoxDeleteCommand()
	cmd.SetArgs([]string{
		"--all",
		"--force", // Force deletion to avoid confirmation prompt
	})
	err := cmd.Execute()
	assert.NoError(t, err)

	// Read captured output
	w.Close()
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	fmt.Fprintf(oldStdout, "Captured output: %s\n", output)

	// Check output
	assert.Contains(t, output, "The following boxes will be deleted")
	assert.Contains(t, output, "All boxes deleted successfully")

	// Verify correct number of requests were sent
	// 1 GET request to list boxes + 2 DELETE requests to delete boxes = 3 requests
	assert.Equal(t, 3, requestCount)
}

// TestDeleteAllBoxesEmpty tests deleting all boxes when there are no boxes
func TestDeleteAllBoxesEmpty(t *testing.T) {
	// Save original stdout and stderr for later restoration
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	// Create mock server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/api/v1/boxes", r.URL.Path)

		// Return empty box list
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(mockEmptyListResponse))
	}))
	defer mockServer.Close()

	// Save original environment variables
	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)

	// Set API URL to mock server
	os.Setenv("API_ENDPOINT", mockServer.URL)

	// Create pipe to capture stdout
	r, w, _ := os.Pipe()
	os.Stdout = w
	os.Stderr = w

	// Execute command
	cmd := NewBoxDeleteCommand()
	cmd.SetArgs([]string{
		"--all",
	})
	err := cmd.Execute()
	assert.NoError(t, err)

	// Read captured output
	w.Close()
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	fmt.Fprintf(oldStdout, "Captured output: %s\n", output)

	// Check output
	assert.Contains(t, output, "No boxes to delete")
}

// TestDeleteBoxWithJSONOutput tests JSON output format
// TestDeleteBoxWithJSONOutput tests JSON output format
func TestDeleteBoxWithJSONOutput(t *testing.T) {
	// Save original stdout and stderr for later restoration
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
	}()

	// Create mock server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle GET /api/v1/boxes for ResolveBoxIDPrefix
		if r.Method == "GET" && r.URL.Path == "/api/v1/boxes" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintln(w, `{"boxes":[{"id":"test-box-id"}]}`)
			return
		}

		// Handle DELETE /api/v1/boxes/test-box-id for the actual delete call
		if r.Method == "DELETE" && r.URL.Path == "/api/v1/boxes/test-box-id" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			// mockDeleteResponse for deleteBox is `{"status":"success","message":"Box deleted successfully"}`
			// but the deleteBox function with --output json prints its own hardcoded JSON.
			// The response from performBoxDeletion is not directly used for the JSON output of deleteBox.
			// So the actual content written by the server for DELETE doesn't strictly matter here, only the status.
			w.Write([]byte(`{"status":"irrelevant_for_this_test"}`)) 
			return
		}
		http.NotFound(w,r)
	}))
	defer mockServer.Close()

	// Save original environment variables
	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)

	// Set API URL to mock server
	os.Setenv("API_ENDPOINT", mockServer.URL)

	// Create pipe to capture stdout
	rPipe, wPipe, _ := os.Pipe()
	os.Stdout = wPipe
	os.Stderr = wPipe

	// Execute command
	cmd := NewBoxDeleteCommand()
	cmd.SetArgs([]string{
		"test-box-id",
		// "--force", // As above, not needed for single delete via args
		"--output", "json",
	})
	err := cmd.Execute()
	assert.NoError(t, err, "cmd.Execute() should not return an error")

	// Read captured output
	wPipe.Close()
	var buf bytes.Buffer
	io.Copy(&buf, rPipe)
	output := buf.String()

	// fmt.Fprintf(oldStdout, "Captured output for TestDeleteBoxWithJSONOutput: %s\n", output)

	// Check output - deleteBox now prints a specific JSON
	expectedJSON := `{"status":"success","message":"Box deleted successfully"}`
	assert.JSONEq(t, expectedJSON, output, "JSON output mismatch")
}
// TestDeleteInvalidInput tests invalid input
func TestDeleteInvalidInput(t *testing.T) {
	// Skip this test as it requires testing os.Exit behavior
	// In Go test environment, os.Exit will directly end the test process
	t.Skip("Need to test os.Exit behavior in a subprocess")

	// Note: To test error cases, you can follow the method described in box_create_test.go
	// to create a subprocess to test os.Exit behavior
}

// TestDeleteAllBoxesWithConfirmation tests deleting all boxes with confirmation
func TestDeleteAllBoxesWithConfirmation(t *testing.T) {
	// Save original stdout, stderr, and stdin for later restoration
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	oldStdin := os.Stdin
	defer func() {
		os.Stdout = oldStdout
		os.Stderr = oldStderr
		os.Stdin = oldStdin
	}()

	// Create mock server
	var requestCount int
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++

		// First request should be to list all boxes
		if requestCount == 1 {
			assert.Equal(t, "GET", r.Method)
			assert.Equal(t, "/api/v1/boxes", r.URL.Path)

			// Return box list
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(mockListResponse))
			return
		}

		// Subsequent requests should be to delete individual boxes
		assert.Equal(t, "DELETE", r.Method)
		assert.True(t, strings.HasPrefix(r.URL.Path, "/api/v1/boxes/box-"))

		// Check request content
		body, err := io.ReadAll(r.Body)
		assert.NoError(t, err)
		defer r.Body.Close()

		var req map[string]interface{}
		err = json.Unmarshal(body, &req)
		assert.NoError(t, err)
		assert.Equal(t, true, req["force"])

		// Return success response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(mockDeleteResponse))
	}))
	defer mockServer.Close()

	// Save original environment variables
	origAPIURL := os.Getenv("API_ENDPOINT")
	defer os.Setenv("API_ENDPOINT", origAPIURL)

	// Set API URL to mock server
	os.Setenv("API_ENDPOINT", mockServer.URL)

	// Simulate user typing "y" for confirmation
	r, w, _ := os.Pipe()
	os.Stdin = r
	// Write "y" to stdin
	go func() {
		w.Write([]byte("y\n"))
		w.Close()
	}()

	// Capture stdout
	outR, outW, _ := os.Pipe()
	os.Stdout = outW
	os.Stderr = outW

	// Execute command
	cmd := NewBoxDeleteCommand()
	cmd.SetArgs([]string{
		"--all", // Delete all boxes, will prompt for confirmation
	})
	err := cmd.Execute()
	assert.NoError(t, err)

	// Read captured output
	outW.Close()
	var buf bytes.Buffer
	io.Copy(&buf, outR)
	output := buf.String()

	fmt.Fprintf(oldStdout, "Captured output: %s\n", output)

	// Check output
	assert.Contains(t, output, "The following boxes will be deleted")
	assert.Contains(t, output, "Are you sure you want to delete all boxes?")
	assert.Contains(t, output, "All boxes deleted successfully")

	// Verify correct number of requests were sent
	// 1 GET request to list boxes + 2 DELETE requests to delete boxes = 3 requests
	assert.Equal(t, 3, requestCount)
}

// TestDeleteHelp tests help information
func TestDeleteHelp(t *testing.T) {
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
	cmd := NewBoxDeleteCommand()
	cmd.SetArgs([]string{
		"--help",
	})
	err := cmd.Execute()
	assert.NoError(t, err)

	// Read captured output
	w.Close()
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	fmt.Fprintf(oldStdout, "Captured output: %s\n", output)

	// Check if help message contains key options and usage
	assert.Contains(t, output, "Usage:")
	assert.Contains(t, output, "--output")
	assert.Contains(t, output, "--all")
	assert.Contains(t, output, "--force")
}
