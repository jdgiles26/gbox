package docker

import (
	"bufio"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/docker/api/types"

	"github.com/babelcloud/gbox/packages/api-server/internal/common"
	model "github.com/babelcloud/gbox/packages/api-server/pkg/box"
)

// Exec implements Service.Exec
func (s *Service) Exec(ctx context.Context, id string, req *model.BoxExecParams) (*model.BoxExecResult, error) {
	// Update access time on exec
	s.accessTracker.Update(id)

	containerInfo, err := s.getContainerByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Check container status
	if containerInfo.State != "running" {
		return nil, fmt.Errorf("box %s is not running (current state: %s)", id, containerInfo.State)
	}

	// Apply timeout if specified
	if req.Timeout != "" {
		if duration, err := time.ParseDuration(req.Timeout); err == nil {
			var cancel context.CancelFunc
			ctx, cancel = context.WithTimeout(ctx, duration)
			defer cancel()
		}
	}

	// Set working directory
	workingDir := common.DefaultWorkDirPath
	if req.WorkingDir != "" {
		workingDir = req.WorkingDir
	}

	// Convert envs to []string
	envs := make([]string, 0, len(req.Envs))
	for k, v := range req.Envs {
		envs = append(envs, fmt.Sprintf("%s=%s", k, v))
	}

	// Create exec configuration (non-interactive)
	execConfig := types.ExecConfig{
		User:         "", // Use default user
		Privileged:   false,
		Tty:          false, // Non-interactive
		AttachStdin:  false, // No stdin for non-interactive
		AttachStdout: true,
		AttachStderr: true,
		Detach:       false,
		DetachKeys:   "", // Use default detach keys
		Env:          envs,
		WorkingDir:   workingDir,
		Cmd:          req.Commands,
	}

	// Create exec instance
	execResp, err := s.client.ContainerExecCreate(ctx, containerInfo.ID, execConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create exec: %w", err)
	}

	// Attach to exec instance
	attachResp, err := s.client.ContainerExecAttach(ctx, execResp.ID, types.ExecStartCheck{
		Detach: false,
		Tty:    false,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to attach to exec: %w", err)
	}
	defer attachResp.Close()

	// Collect output
	stdout, stderr := s.collectOutput(attachResp.Reader, -1, -1)

	// Get exit code
	inspectResp, err := s.client.ContainerExecInspect(ctx, execResp.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect exec: %w", err)
	}

	return &model.BoxExecResult{
		ExitCode: inspectResp.ExitCode,
		Stdout:   stdout,
		Stderr:   stderr,
	}, nil
}

// readDockerStream reads from a Docker stream and returns stdout and stderr content
func readDockerStream(reader io.Reader) (string, string, error) {
	header := make([]byte, 8)
	var stdout, stderr strings.Builder

	for {
		// Read header
		_, err := io.ReadFull(reader, header)
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", "", fmt.Errorf("error reading stream header: %w", err)
		}

		// Parse header
		streamType := header[0]
		// Skip 3 bytes reserved for future use
		size := binary.BigEndian.Uint32(header[4:])

		// Read payload
		payload := make([]byte, size)
		_, err = io.ReadFull(reader, payload)
		if err != nil {
			return "", "", fmt.Errorf("error reading stream payload: %w", err)
		}

		// Write to appropriate output based on stream type
		switch streamType {
		case 1: // stdout
			stdout.Write(payload)
		case 2: // stderr
			stderr.Write(payload)
		}
	}

	return stdout.String(), stderr.String(), nil
}

// collectOutput collects output from a reader with line limit
func (s *Service) collectOutput(reader io.Reader, stdoutLimit, stderrLimit int) (string, string) {
	stdout, stderr, err := readDockerStream(reader)
	if err != nil {
		s.logger.Error("Error reading Docker stream: %v", err)
		return "", ""
	}

	// Process stdout with line limit
	var stdoutLines []string
	if stdoutLimit >= 0 {
		scanner := bufio.NewScanner(strings.NewReader(stdout))
		for scanner.Scan() && len(stdoutLines) < stdoutLimit {
			stdoutLines = append(stdoutLines, scanner.Text())
		}
		stdout = strings.Join(stdoutLines, "\n")
	}

	// Process stderr with line limit
	var stderrLines []string
	if stderrLimit >= 0 {
		scanner := bufio.NewScanner(strings.NewReader(stderr))
		for scanner.Scan() && len(stderrLines) < stderrLimit {
			stderrLines = append(stderrLines, scanner.Text())
		}
		stderr = strings.Join(stderrLines, "\n")
	}

	return stdout, stderr
}

// RunCode implements Service.RunCode
func (s *Service) RunCode(ctx context.Context, id string, req *model.BoxRunCodeParams) (*model.BoxRunCodeResult, error) {
	// Update access time on run
	s.accessTracker.Update(id)

	containerInfo, err := s.getContainerByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Check container status
	if containerInfo.State != "running" {
		return nil, fmt.Errorf("box %s is not running (current state: %s)", id, containerInfo.State)
	}

	// Prepare command and stdin
	cmd, stdin, err := s.prepareRunCodeCommand(req)
	if err != nil {
		return nil, err
	}

	// Execute the command
	return s.executeRunCode(ctx, containerInfo.ID, cmd, stdin, req)
}

// prepareRunCodeCommand prepares the command and stdin for code execution
func (s *Service) prepareRunCodeCommand(req *model.BoxRunCodeParams) ([]string, string, error) {
	if req.Code == "" || req.Language == "" {
		return nil, "", fmt.Errorf("code and language are required for run-code functionality")
	}

	var cmd []string
	var stdin string

	switch req.Language {
	case "python3":
		cmd = []string{"python3"}
		stdin = req.Code
	case "typescript":
		cmd = []string{"npx", "ts-node"}
		stdin = req.Code
	case "bash":
		cmd = []string{"sh", "-c", req.Code}
		stdin = ""
	default:
		return nil, "", fmt.Errorf("unsupported code type: %s", req.Language)
	}

	// Add argv to cmd
	cmd = append(cmd, req.Argv...)

	return cmd, stdin, nil
}

// executeRunCode executes the prepared command and collects results
func (s *Service) executeRunCode(ctx context.Context, containerID string, cmd []string, stdin string, req *model.BoxRunCodeParams) (*model.BoxRunCodeResult, error) {
	// Create exec configuration
	execConfig := s.createRunCodeExecConfig(cmd, stdin, req)

	// Create and attach to exec instance
	execResp, err := s.client.ContainerExecCreate(ctx, containerID, execConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create exec: %w", err)
	}

	attachResp, err := s.client.ContainerExecAttach(ctx, execResp.ID, types.ExecStartCheck{
		Detach: false,
		Tty:    false,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to attach to exec: %w", err)
	}
	defer attachResp.Close()

	// Handle stdin and collect output
	return s.handleRunCodeExecution(ctx, execResp.ID, attachResp, stdin)
}

// createRunCodeExecConfig creates the exec configuration for running code
func (s *Service) createRunCodeExecConfig(cmd []string, stdin string, req *model.BoxRunCodeParams) types.ExecConfig {
	// Set working directory
	workingDir := common.DefaultWorkDirPath
	if req.WorkingDir != "" {
		workingDir = req.WorkingDir
	}

	// Convert envs to []string
	envs := make([]string, 0, len(req.Envs))
	for k, v := range req.Envs {
		envs = append(envs, fmt.Sprintf("%s=%s", k, v))
	}

	return types.ExecConfig{
		User:         "", // Use default user
		Privileged:   false,
		Tty:          false, // Run commands typically don't need TTY
		AttachStdin:  stdin != "",
		AttachStdout: true,
		AttachStderr: true,
		Detach:       false,
		DetachKeys:   "", // Use default detach keys
		Env:          envs,
		WorkingDir:   workingDir,
		Cmd:          cmd,
	}
}

// handleRunCodeExecution handles the execution, stdin writing, and output collection
func (s *Service) handleRunCodeExecution(ctx context.Context, execID string, attachResp types.HijackedResponse, stdin string) (*model.BoxRunCodeResult, error) {
	// Use a single channel for coordination
	type executionResult struct {
		stdout   string
		stderr   string
		exitCode int
		err      error
	}

	resultChan := make(chan executionResult, 1)

	// Start goroutine to handle the entire execution
	go func() {
		defer close(resultChan)

		// Write stdin if provided
		if stdin != "" {
			if err := s.writeStdinForRunCode(attachResp.Conn, stdin); err != nil {
				resultChan <- executionResult{err: fmt.Errorf("failed to write stdin: %w", err)}
				return
			}
		}

		// Collect output
		stdout, stderr := s.collectOutput(attachResp.Reader, -1, -1)

		// Get exit code
		exitCode, err := s.getExecExitCode(ctx, execID)
		if err != nil {
			resultChan <- executionResult{err: fmt.Errorf("failed to get exit code: %w", err)}
			return
		}

		resultChan <- executionResult{
			stdout:   stdout,
			stderr:   stderr,
			exitCode: exitCode,
		}
	}()

	// Wait for completion or context cancellation
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case result := <-resultChan:
		if result.err != nil {
			return nil, result.err
		}
		return &model.BoxRunCodeResult{
			ExitCode: result.exitCode,
			Stdout:   result.stdout,
			Stderr:   result.stderr,
		}, nil
	}
}

// writeStdinForRunCode writes stdin data and closes the write end
func (s *Service) writeStdinForRunCode(writer io.Writer, stdin string) error {
	if _, err := io.WriteString(writer, stdin); err != nil {
		return err
	}

	// Close write end of the connection to signal EOF
	if closer, ok := writer.(interface{ CloseWrite() error }); ok {
		return closer.CloseWrite()
	}

	return nil
}

// getExecExitCode gets the exit code of an exec instance
func (s *Service) getExecExitCode(ctx context.Context, execID string) (int, error) {
	inspectResp, err := s.client.ContainerExecInspect(ctx, execID)
	if err != nil {
		return -1, err
	}
	return inspectResp.ExitCode, nil
}

// isConnectionClosed checks if the error is due to a closed connection
func isConnectionClosed(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "use of closed network connection") ||
		strings.Contains(err.Error(), "io: read/write on closed pipe")
}

// --- Stream-related methods (temporarily commented out for future stream support) ---

// streamMultiplexed handles multiplexed streaming of stdout and stderr
// func (s *Service) streamMultiplexed(reader io.Reader, writer io.Writer) {
// 	header := make([]byte, 8)
// 	for {
// 		// Read header
// 		_, err := io.ReadFull(reader, header)
// 		if err != nil {
// 			if err != io.EOF && !isConnectionClosed(err) {
// 				s.logger.Error("Error reading stream header: %v", err)
// 			}
// 			return
// 		}

// 		// Parse header
// 		streamType := header[0]
// 		frameSize := binary.BigEndian.Uint32(header[4:])

// 		// Read frame
// 		frame := make([]byte, frameSize)
// 		_, err = io.ReadFull(reader, frame)
// 		if err != nil {
// 			if err != io.EOF && !isConnectionClosed(err) {
// 				s.logger.Error("Error reading stream frame: %v", err)
// 			}
// 			return
// 		}

// 		// Write header and frame to client
// 		if _, err := writer.Write(header); err != nil {
// 			if !isConnectionClosed(err) {
// 				s.logger.Error("Error writing stream header: %v", err)
// 			}
// 			return
// 		}
// 		if _, err := writer.Write(frame); err != nil {
// 			if !isConnectionClosed(err) {
// 				s.logger.Error("Error writing stream frame: %v", err)
// 			}
// 			return
// 		}

// 		// Log stream type and size for debugging
// 		s.logger.Debug("Stream type: %d, size: %d", streamType, frameSize)
// 	}
// }

// handleStdin handles stdin stream
// func (s *Service) handleStdin(reader io.Reader, writer io.Writer) {
// 	_, err := io.Copy(writer, reader)
// 	if err != nil && !isConnectionClosed(err) {
// 		s.logger.Error("Error copying stdin: %v", err)
// 	}
// 	// Signal EOF to the container
// 	if closer, ok := writer.(interface{ CloseWrite() error }); ok {
// 		if err := closer.CloseWrite(); err != nil {
// 			s.logger.Error("Error closing write end: %v", err)
// 		}
// 	}
// }
