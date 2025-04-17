package service

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/babelcloud/gbox/packages/api-server/internal/common"
	boxModel "github.com/babelcloud/gbox/packages/api-server/pkg/box"
	model "github.com/babelcloud/gbox/packages/api-server/pkg/file"
)

// WriteFile writes content to a file at the specified path
func (s *FileService) WriteFile(ctx context.Context, boxID string, path string, content string) (*model.FileShareResult, error) {
	pathWithBoxID := path
	if !strings.HasPrefix(path, "/"+boxID) {
		pathWithBoxID = boxID + path
	}

	cleanPath, err := s.validateAndCleanPath(pathWithBoxID)
	if err != nil {
		return nil, err
	}

	// Construct full path
	fullPath := s.getFullPath(cleanPath)

	// Ensure the directory exists
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("error creating directory: %v", err)
	}

	// Create or truncate the file
	file, err := os.Create(fullPath)
	if err != nil {
		return nil, fmt.Errorf("error creating file: %v", err)
	}
	defer file.Close()
	// Write the content
	if _, err := file.WriteString(content); err != nil {
		return nil, fmt.Errorf("error writing file content: %v", err)
	}

	// If the file is not in the share directory, we need to copy it to the sandbox
	if !strings.HasPrefix(cleanPath, "/"+boxID+common.DefaultShareDirPath) {
		pathInBox := filepath.Join(common.DefaultShareDirPath, path)
		_, err := s.boxSvc.Run(ctx, boxID, &boxModel.BoxRunParams{
			Cmd: []string{"cp", pathInBox, path},
		})
		if err != nil {
			return nil, fmt.Errorf("error copying file to sandbox: %v", err)
		}
	}

	fileList, err := getFileList(fullPath)
	if err != nil {
		return nil, fmt.Errorf("error getting file list: %v", err)
	}

	// Prepare response
	response := &model.FileShareResult{
		Success:  true,
		Message:  "File written successfully",
		FileList: fileList,
	}

	return response, nil
}
