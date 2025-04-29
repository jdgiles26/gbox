package docker

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/babelcloud/gbox/packages/api-server/internal/common"
	model "github.com/babelcloud/gbox/packages/api-server/pkg/box"
	"github.com/docker/docker/api/types"
	"github.com/gorilla/websocket"
)

// ExecWS implements Service.ExecWS for WebSocket connections
func (s *Service) ExecWS(ctx context.Context, id string, params *model.BoxExecWSParams, wsConn *websocket.Conn) (*model.BoxExecResult, error) {
	s.accessTracker.Update(id)

	containerInfo, err := s.getContainerByID(ctx, id)
	if err != nil {
		return nil, err // Includes ErrBoxNotFound
	}

	// Check container status, if not running, start it
	if containerInfo.State != "running" {
		fmt.Printf("Before exec, container(%s) is not running, starting it...\n", id)
		if _, err := s.Start(ctx, id); err != nil {
			return nil, fmt.Errorf("failed to start container: %w", err)
		}
		containerInfo, err = s.getContainerByID(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("failed to update container: %w", err)
		}
	}

	// Create exec configuration
	execConfig := types.ExecConfig{
		User:         "", // Use default user
		Privileged:   false,
		Tty:          params.TTY,
		AttachStdin:  true, // Always attach stdin for WebSocket
		AttachStdout: true,
		AttachStderr: true,
		Detach:       false,
		DetachKeys:   "",  // Use default detach keys
		Env:          nil, // No additional environment variables for now
		WorkingDir:   common.DefaultWorkDirPath,
		Cmd:          append(params.Cmd, params.Args...),
	}

	// Create exec instance
	execResp, err := s.client.ContainerExecCreate(ctx, containerInfo.ID, execConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create exec: %w", err)
	}

	// Attach to exec instance
	attachResp, err := s.client.ContainerExecAttach(ctx, execResp.ID, types.ExecStartCheck{
		Detach: false,
		Tty:    params.TTY,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to attach to exec: %w", err)
	}
	defer attachResp.Close() // Close the underlying hijack connection when done

	errChan := make(chan error, 2) // Channel for errors from goroutines
	copyDone := make(chan bool, 2) // Track completion of copy routines

	var mu sync.Mutex

	// Goroutine: Read from Docker stdout/stderr -> Write to WebSocket
	go func() {
		defer func() {
			copyDone <- true
			s.logger.Debugf("ExecWS [%s]: Docker output stream ended. Goroutine finished.", id)
		}()
		var writeErr error
		if params.TTY {
			// TTY mode: Raw stream copy using helper
			_, writeErr = io.Copy(&wsWriter{conn: wsConn}, attachResp.Reader)
		} else {
			// Non-TTY mode: Multiplexed stream copy using helper
			writeErr = s.streamMultiplexedToWS(attachResp.Reader, wsConn)
		}
		if writeErr != nil && !isConnectionClosed(writeErr) {
			s.logger.Errorf("ExecWS [%s]: Error writing to WebSocket: %v", id, writeErr)
			errChan <- fmt.Errorf("websocket write error: %w", writeErr)
		}
	}()

	// Goroutine: Read from WebSocket -> Write to Docker stdin
	go func() {
		defer func() {
			copyDone <- true
			// Close the write side of the Docker attach connection to signal EOF to stdin
			if closeWriter, ok := attachResp.Conn.(interface{ CloseWrite() error }); ok {
				s.logger.Debugf("ExecWS [%s]: Closing docker stdin pipe", id)
				if err := closeWriter.CloseWrite(); err != nil && !isConnectionClosed(err) {
					s.logger.Warnf("ExecWS [%s]: Error closing docker stdin pipe: %v", id, err)
				}
			} else {
				s.logger.Warnf("ExecWS [%s]: Could not get CloseWrite() for docker stdin pipe", id)
			}
		}()
		for {
			messageType, message, err := wsConn.ReadMessage()
			if err != nil {
				// Check for clean WebSocket closure first
				if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
					mu.Lock()
					s.logger.Infof("ExecWS [%s]: WebSocket connection closed cleanly by client.", id)
					mu.Unlock()
				} else if errors.Is(err, net.ErrClosed) {
					s.logger.Warnf("ExecWS [%s]: Underlying network connection closed (expected during shutdown): %v", id, err)
				} else {
					s.logger.Errorf("ExecWS [%s]: Unexpected error reading from WebSocket: %v", id, err)
					errChan <- fmt.Errorf("websocket read error: %w", err)
				}
				return // Exit goroutine on any error or close
			}

			if messageType == websocket.TextMessage || messageType == websocket.BinaryMessage {
				_, err = attachResp.Conn.Write(message)
				if err != nil {
					if isConnectionClosed(err) {
						s.logger.Debugf("ExecWS [%s]: Docker stdin pipe closed while writing.", id)
						return // Pipe closed, exit goroutine normally
					}
					s.logger.Errorf("ExecWS [%s]: Error writing to docker stdin: %v", id, err)
					errChan <- fmt.Errorf("docker stdin write error: %w", err)
					return // Exit goroutine if write fails
				}
			} else if messageType == websocket.CloseMessage {
				s.logger.Infof("ExecWS [%s]: Received WebSocket close message.", id)
				mu.Lock()
				s.logger.Infof("ExecWS [%s]: WebSocket connection closed cleanly by client.", id)
				mu.Unlock()
				return // Exit goroutine
			} else {
				s.logger.Debugf("ExecWS [%s]: Ignored WebSocket message type: %d", id, messageType)
			}
		}
	}()

	// Wait primarily for the Docker output goroutine to finish, or an error/cancellation.
	var firstError error
loop:
	for {
		select {
		case err := <-errChan:
			if err != nil && firstError == nil {
				firstError = err
				s.logger.Errorf("ExecWS [%s]: Goroutine finished with error: %v", id, err)
				// Log the error, but wait for copyDone signals (as appropriate for TTY/non-TTY)
			}
		case <-copyDone:
			s.logger.Debugf("ExecWS [%s]: A copy goroutine finished. Proceeding to cleanup.", id)
			break loop // Exit loop on the first completion signal (should be Docker output stream ending)
		case <-ctx.Done():
			if firstError == nil { // Record context error only if no other error occurred
				firstError = ctx.Err()
			}
			s.logger.Errorf("ExecWS [%s]: Context cancelled: %v", id, ctx.Err())
			break loop // Exit loop on context cancellation
		}
	}

	s.logger.Infof("ExecWS [%s]: Docker output finished or error occurred. Proceeding to inspect exit code. First error: %v", id, firstError)

	// Get exit code (use a separate context for inspect)
	inspectCtx, cancelInspect := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancelInspect()
	inspectResp, inspectErr := s.client.ContainerExecInspect(inspectCtx, execResp.ID)
	if inspectErr != nil {
		s.logger.Errorf("ExecWS [%s]: Failed to inspect exec after completion: %v", id, inspectErr)
		// If we already had an I/O error, prioritize that
		if firstError == nil {
			firstError = fmt.Errorf("failed to inspect exec: %w", inspectErr)
		}
	}

	// Determine final result and error
	exitCode := -1
	if inspectErr == nil {
		exitCode = inspectResp.ExitCode
	}
	s.logger.Infof("ExecWS [%s]: Command finished. Exit Code: %d. Final Error recorded: %v", id, exitCode, firstError)

	// 1. Attempt to send Exit Code JSON
	if inspectErr == nil {
		exitMsg := map[string]interface{}{"type": "exit", "exitCode": exitCode}
		if writeErr := wsConn.WriteJSON(exitMsg); writeErr != nil {
			if !websocket.IsCloseError(writeErr, websocket.CloseNormalClosure, websocket.CloseGoingAway) && !isConnectionClosed(writeErr) {
				s.logger.Warnf("ExecWS [%s]: Failed to send exit code JSON message (connection might be closed): %v", id, writeErr)
			} else {
				s.logger.Infof("ExecWS [%s]: Could not send exit code JSON; connection already closed: %v", id, writeErr)
			}
		} else {
			s.logger.Debugf("ExecWS [%s]: Sent exit code %d over WebSocket.", id, exitCode)
		}
	}

	// 2. Attempt to send a WebSocket close frame
	s.logger.Debugf("ExecWS [%s]: Attempting to send WebSocket close frame from server side.", id)
	// Ignore error here, as the connection might already be closing or closed.
	_ = wsConn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "Command finished"))
	// 3. The deferred wsConn.Close() at the function start will handle final cleanup.

	if firstError != nil {
		expectedReadErr := fmt.Sprintf("websocket read error: %s", websocket.FormatCloseMessage(websocket.CloseNormalClosure, "Command finished"))
		clientNormalCloseErr := "websocket read error: websocket: close 1000 (normal)"

		if firstError.Error() == expectedReadErr || firstError.Error() == clientNormalCloseErr {
			s.logger.Infof("ExecWS [%s]: Suppressing expected WebSocket close error after command finished.", id)
			if inspectErr == nil {
				return &model.BoxExecResult{ExitCode: exitCode}, nil
			}
			return nil, fmt.Errorf("failed to inspect exec after command finished: %w", inspectErr)
		}
		return nil, firstError
	}

	// Return the result if no major errors occurred during I/O
	return &model.BoxExecResult{
		ExitCode: exitCode,
	}, nil
}

// wsWriter is a helper to wrap a websocket.Conn to satisfy io.Writer for io.Copy
type wsWriter struct {
	conn *websocket.Conn
}

func (w *wsWriter) Write(p []byte) (n int, err error) {
	// Use BinaryMessage for raw TTY stream or framed stream data
	err = w.conn.WriteMessage(websocket.BinaryMessage, p)
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

// streamMultiplexedToWS reads the Docker multiplexed stream and writes framed messages to WebSocket.
// Each WebSocket message will be: [StreamType (1 byte)][Payload Data]
func (s *Service) streamMultiplexedToWS(reader io.Reader, wsConn *websocket.Conn) error {
	header := make([]byte, 8) // Docker stream header is 8 bytes
	// frameBuffer := make([]byte, 32*1024) // Removed unused buffer

	for {
		// Read the 8-byte header
		_, err := io.ReadFull(reader, header)
		if err != nil {
			if err == io.EOF || isConnectionClosed(err) {
				return nil // Clean exit from Docker stream
			}
			return fmt.Errorf("read stream header error: %w", err)
		}

		streamType := header[0] // 1 for stdout, 2 for stderr
		frameSize := binary.BigEndian.Uint32(header[4:])

		if frameSize == 0 {
			continue // Skip empty frames
		}

		// Prepare the WebSocket message buffer: 1 byte for type + frameSize for payload
		wsMessage := make([]byte, 1+frameSize)
		wsMessage[0] = streamType

		// Read the frame payload directly into the correct part of the WebSocket message buffer
		payloadBuffer := wsMessage[1:]
		_, err = io.ReadFull(reader, payloadBuffer)
		if err != nil {
			if err == io.EOF || isConnectionClosed(err) {
				s.logger.Warnf("EOF or closed connection while reading frame payload (size %d). Possible unclean termination.", frameSize)
				return nil // Consider this finished, though potentially incomplete
			}
			return fmt.Errorf("read stream payload error (size %d): %w", frameSize, err)
		}

		// Write the complete framed message (Type + Payload) to WebSocket
		err = wsConn.WriteMessage(websocket.BinaryMessage, wsMessage)
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				return nil // Client closed connection
			}
			return fmt.Errorf("websocket write frame error: %w", err)
		}
	}
}
