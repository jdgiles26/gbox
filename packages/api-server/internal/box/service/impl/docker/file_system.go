package docker

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/docker/docker/api/types"

	model "github.com/babelcloud/gbox/packages/api-server/pkg/box"
)

// ListFiles lists files in a directory within a container
func (s *Service) ListFiles(ctx context.Context, id string, params *model.BoxFileListParams) (*model.BoxFileListResult, error) {
	// Get container info first to validate box exists
	containerInfo, err := s.getContainerByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Ensure container is running
	if containerInfo.State != "running" {
		return nil, fmt.Errorf("box %s is not running", id)
	}

	// Build ls command based on depth
	path := params.Path
	if path == "" {
		path = "/"
	}

	// Use ls command to list files
	cmd := []string{"ls", "-la", "--time-style=iso", path}
	if params.Depth > 1 {
		// For depth > 1, use find command
		maxDepth := int(params.Depth)
		cmd = []string{"find", path, "-maxdepth", strconv.Itoa(maxDepth), "-ls"}
	}

	execConfig := types.ExecConfig{
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
	}

	execID, err := s.client.ContainerExecCreate(ctx, containerInfo.ID, execConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create exec: %w", err)
	}

	resp, err := s.client.ContainerExecAttach(ctx, execID.ID, types.ExecStartCheck{})
	if err != nil {
		return nil, fmt.Errorf("failed to attach exec: %w", err)
	}
	defer resp.Close()

	// Read output
	output := &bytes.Buffer{}
	_, err = io.Copy(output, resp.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read exec output: %w", err)
	}

	// Parse ls output to BoxFile structs
	files, err := s.parseLsOutput(output.String(), path)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ls output: %w", err)
	}

	return &model.BoxFileListResult{
		Data: files,
	}, nil
}

// ReadFile reads the content of a file within a container
func (s *Service) ReadFile(ctx context.Context, id string, params *model.BoxFileReadParams) (*model.BoxFileReadResult, error) {
	// Get container info first to validate box exists
	containerInfo, err := s.getContainerByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Ensure container is running
	if containerInfo.State != "running" {
		return nil, fmt.Errorf("box %s is not running", id)
	}

	// Use cat command to read file content
	cmd := []string{"cat", params.Path}

	execConfig := types.ExecConfig{
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
	}

	execID, err := s.client.ContainerExecCreate(ctx, containerInfo.ID, execConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create exec: %w", err)
	}

	resp, err := s.client.ContainerExecAttach(ctx, execID.ID, types.ExecStartCheck{})
	if err != nil {
		return nil, fmt.Errorf("failed to attach exec: %w", err)
	}
	defer resp.Close()

	// Read file content
	content := &bytes.Buffer{}
	_, err = io.Copy(content, resp.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read file content: %w", err)
	}

	// Check exec exit code
	inspect, err := s.client.ContainerExecInspect(ctx, execID.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect exec: %w", err)
	}

	if inspect.ExitCode != 0 {
		return nil, fmt.Errorf("failed to read file %s: command exited with code %d", params.Path, inspect.ExitCode)
	}

	return &model.BoxFileReadResult{
		Content: content.String(),
	}, nil
}

// WriteFile writes content to a file within a container
func (s *Service) WriteFile(ctx context.Context, id string, params *model.BoxFileWriteParams) (*model.BoxFileWriteResult, error) {
	// Get container info first to validate box exists
	containerInfo, err := s.getContainerByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Ensure container is running
	if containerInfo.State != "running" {
		return nil, fmt.Errorf("box %s is not running", id)
	}

	// Create parent directory if it doesn't exist
	parentDir := filepath.Dir(params.Path)
	if parentDir != "/" && parentDir != "." {
		mkdirCmd := []string{"mkdir", "-p", parentDir}
		mkdirExecConfig := types.ExecConfig{
			Cmd:          mkdirCmd,
			AttachStdout: true,
			AttachStderr: true,
		}

		mkdirExecID, err := s.client.ContainerExecCreate(ctx, containerInfo.ID, mkdirExecConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to create mkdir exec: %w", err)
		}

		mkdirResp, err := s.client.ContainerExecAttach(ctx, mkdirExecID.ID, types.ExecStartCheck{})
		if err != nil {
			return nil, fmt.Errorf("failed to attach mkdir exec: %w", err)
		}
		mkdirResp.Close()
	}

	// Use sh -c to write file content with proper escaping
	escapedContent := strings.ReplaceAll(params.Content, "'", "'\"'\"'")
	cmd := []string{"sh", "-c", fmt.Sprintf("echo '%s' > '%s'", escapedContent, params.Path)}

	execConfig := types.ExecConfig{
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
	}

	execID, err := s.client.ContainerExecCreate(ctx, containerInfo.ID, execConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create exec: %w", err)
	}

	resp, err := s.client.ContainerExecAttach(ctx, execID.ID, types.ExecStartCheck{})
	if err != nil {
		return nil, fmt.Errorf("failed to attach exec: %w", err)
	}
	defer resp.Close()

	// Read any output (mainly for error detection)
	output := &bytes.Buffer{}
	_, err = io.Copy(output, resp.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read exec output: %w", err)
	}

	// Check exec exit code
	inspect, err := s.client.ContainerExecInspect(ctx, execID.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect exec: %w", err)
	}

	if inspect.ExitCode != 0 {
		return nil, fmt.Errorf("failed to write file %s: command exited with code %d, output: %s", params.Path, inspect.ExitCode, output.String())
	}

	return &model.BoxFileWriteResult{
		Message: fmt.Sprintf("File %s written successfully", params.Path),
	}, nil
}

// parseLsOutput parses the output of ls command and returns BoxFile structs
func (s *Service) parseLsOutput(output, basePath string) ([]model.BoxFile, error) {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	var files []model.BoxFile

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "total") {
			continue
		}

		// Parse ls -la output format
		// Example: -rw-r--r-- 1 root root 1234 2023-01-01 12:00 filename
		fields := strings.Fields(line)
		if len(fields) < 9 {
			continue // Skip malformed lines
		}

		permissions := fields[0]
		size := fields[4]

		// Date and time can be in different formats, try to parse
		var lastModified time.Time
		if len(fields) >= 8 {
			// Try different date formats
			dateTimeStr := strings.Join(fields[5:8], " ")
			formats := []string{
				"2006-01-02 15:04",
				"Jan 02 15:04",
				"Jan 02 2006",
			}

			for _, format := range formats {
				if parsed, err := time.Parse(format, dateTimeStr); err == nil {
					lastModified = parsed
					break
				}
			}
		}

		// Filename is the rest of the fields joined
		filename := strings.Join(fields[8:], " ")

		// Skip . and .. entries
		if filename == "." || filename == ".." {
			continue
		}

		// Determine file type
		fileType := "file"
		if strings.HasPrefix(permissions, "d") {
			fileType = "directory"
		} else if strings.HasPrefix(permissions, "l") {
			fileType = "symlink"
		}

		// Build full path
		fullPath := filepath.Join(basePath, filename)
		if basePath == "/" {
			fullPath = "/" + filename
		}

		files = append(files, model.BoxFile{
			Name:         filename,
			Path:         fullPath,
			Type:         fileType,
			Size:         size,
			LastModified: lastModified,
		})
	}

	return files, nil
}
