package service

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"archive/tar"

	"github.com/babelcloud/gbox/packages/api-server/internal/common"
	boxModel "github.com/babelcloud/gbox/packages/api-server/pkg/box"
	fileModel "github.com/babelcloud/gbox/packages/api-server/pkg/file"
)

// ShareFile shares a file from a box to the share directory
func (s *FileService) ShareFile(ctx context.Context, boxID, pathWithBoxID string) (*fileModel.FileShareResult, error) {
	if boxID == "" {
		return nil, fmt.Errorf("box ID is required")
	}

	cleanPath, err := s.validateAndCleanPath(pathWithBoxID)
	if err != nil {
		return nil, err
	}

	// TODO: need to check if the file is a directory, only file can be shared

	// Check if path starts with default share directory path
	if strings.HasPrefix(cleanPath, "/"+boxID+common.DefaultShareDirPath) {
		// Remove the prefix to get the relative path
		relativePath := strings.TrimPrefix(cleanPath, "/"+boxID+common.DefaultShareDirPath)
		relativePath = filepath.Clean(relativePath)
		if !strings.HasPrefix(relativePath, "/") {
			relativePath = "/" + relativePath
		}

		// Check if file already exists in share directory
		sharePath := filepath.Join(s.shareDir, boxID, relativePath)
		if _, err := os.Stat(sharePath); err == nil {
			// File exists, return success with file list
			fileList, err := getFileList(sharePath)
			if err != nil {
				log.Error("Error getting file list: %v", err)
			}
			return &fileModel.FileShareResult{
				Success:  true,
				Message:  "File already exists",
				FileList: fileList,
			}, nil
		} else {
			// File does not exist, raise error
			return nil, fmt.Errorf("file does not exist")
		}
	}

	// Create share directory for the box if it doesn't exist
	boxShareDir := filepath.Join(s.shareDir, boxID)
	if err := os.MkdirAll(boxShareDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create share directory: %v", err)
	}

	// Create target directory if it doesn't exist
	targetDir := filepath.Dir(filepath.Join(boxShareDir, cleanPath))
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create target directory: %v", err)
	}

	// Get file from box
	archiveResult, reader, err := s.boxSvc.GetArchive(ctx, boxID, &boxModel.BoxArchiveGetParams{
		Path: cleanPath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get file from box: %v", err)
	}
	defer reader.Close()

	// Create the target file
	targetPath := filepath.Join(boxShareDir, cleanPath)
	targetFile, err := os.Create(targetPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create target file: %v", err)
	}
	defer targetFile.Close()

	// Extract the file from tar archive
	tarReader := tar.NewReader(reader)
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read tar header: %v", err)
		}

		// Skip if not a regular file
		if header.Typeflag != tar.TypeReg {
			continue
		}

		// Write the file content
		_, err = io.Copy(targetFile, tarReader)
		if err != nil {
			return nil, fmt.Errorf("failed to write file content: %v", err)
		}
		break // We only need the first file
	}

	// Set file permissions
	if err := os.Chmod(targetPath, os.FileMode(archiveResult.Mode)); err != nil {
		return nil, fmt.Errorf("failed to set file permissions: %v", err)
	}

	// Get the list of shared files
	fileList, err := getFileList(filepath.Join(boxShareDir, cleanPath))
	if err != nil {
		log.Error("Error getting file list: %v", err)
	}

	return &fileModel.FileShareResult{
		Success:  true,
		Message:  "File shared successfully",
		FileList: fileList,
	}, nil
}
