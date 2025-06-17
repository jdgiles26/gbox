package docker

import (
	"context"
	"errors"
	"io"
	"sync"

	"github.com/babelcloud/gbox/packages/api-server/pkg/logger"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
)

// imageTrigger is an interface for triggers processed by the ImageService.
type imageTrigger interface {
	execute(ctx context.Context, s *ImageService) error
}

// pullImageTrigger is a trigger to pull a Docker image.
type pullImageTrigger struct {
	imageRef string
	writer   io.Writer // Optional writer for progress.
}

func (t *pullImageTrigger) execute(ctx context.Context, s *ImageService) error {
	imageWithTag := EnsureImageTag(t.imageRef)
	s.logger.Info("ImageService: Pulling image %s", imageWithTag)

	if err := s.pullImage(ctx, imageWithTag, t.writer); err != nil {
		// Don't log an error if the context was just cancelled.
		if !errors.Is(err, context.Canceled) {
			s.logger.Error("ImageService: Failed to pull image %s: %v", imageWithTag, err)
		}
		return err
	}

	s.logger.Info("ImageService: Successfully pulled image %s", imageWithTag)

	// After pulling, trigger a prune to clean up old versions.
	return s.pruneImages(ctx, imageWithTag)
}

// pruneImagesTrigger is a trigger to prune old versions of a specific image.
type pruneImagesTrigger struct {
	imageRef string
}

func (t *pruneImagesTrigger) execute(ctx context.Context, s *ImageService) error {
	imageWithTag := EnsureImageTag(t.imageRef)
	s.logger.Info("ImageService: Pruning old versions of image %s", imageWithTag)
	return s.pruneImages(ctx, imageWithTag)
}

// ImageService manages Docker images in the background via triggers.
type ImageService struct {
	client      *client.Client
	logger      *logger.Logger
	triggerChan chan imageTrigger
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc
}

// NewImageService creates a new ImageService.
func NewImageService(dockerClient *client.Client, logger *logger.Logger) *ImageService {
	ctx, cancel := context.WithCancel(context.Background())
	return &ImageService{
		client:      dockerClient,
		logger:      logger,
		triggerChan: make(chan imageTrigger, 10), // Buffered channel.
		wg:          sync.WaitGroup{},
		ctx:         ctx,
		cancel:      cancel,
	}
}

// Start begins the background image management goroutine.
func (s *ImageService) Start() {
	s.wg.Add(1)
	go s.run()
	s.logger.Info("ImageService started")

	// Enqueue an initial pull for the default image.
	// This maintains the original behavior of ensuring the default image is present.
	defaultImage := GetImage("")
	select {
	case s.triggerChan <- &pullImageTrigger{imageRef: defaultImage, writer: nil}:
	default:
		// This is unlikely to happen on startup, but good to have.
		s.logger.Warn("ImageService: Trigger channel full on startup. Discarding initial pull.")
	}
}

// Stop gracefully stops the image management service.
func (s *ImageService) Stop() {
	s.logger.Info("ImageService: Stopping...")
	s.cancel() // Cancel the context to unblock any running operations.
	s.wg.Wait()
	s.logger.Info("ImageService stopped")
}

// run is the main loop that executes image management tasks.
func (s *ImageService) run() {
	defer s.wg.Done()

	for {
		select {
		case trigger := <-s.triggerChan:
			if err := trigger.execute(s.ctx, s); err != nil {
				// Check if the context was cancelled.
				if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
					s.logger.Info("ImageService: Trigger execution cancelled.")
				} else {
					s.logger.Error("ImageService: Error executing trigger: %v", err)
				}
			}
		case <-s.ctx.Done():
			s.logger.Info("ImageService: Received stop signal, shutting down run loop.")
			return
		}
	}
}

// PullImage sends a trigger to pull an image.
func (s *ImageService) PullImage(imageRef string, writer io.Writer) {
	select {
	case s.triggerChan <- &pullImageTrigger{imageRef: imageRef, writer: writer}:
	case <-s.ctx.Done():
		s.logger.Warn("ImageService: Could not send pull trigger, service is shutting down.")
	default:
		s.logger.Warn("ImageService: Trigger channel is full. Discarding pull request for %s.", imageRef)
	}
}

// PruneImages sends a trigger to prune old versions of an image.
func (s *ImageService) PruneImages(imageRef string) {
	select {
	case s.triggerChan <- &pruneImagesTrigger{imageRef: imageRef}:
	case <-s.ctx.Done():
		s.logger.Warn("ImageService: Could not send prune trigger, service is shutting down.")
	default:
		s.logger.Warn("ImageService: Trigger channel is full. Discarding prune request for %s.", imageRef)
	}
}

// pullImage pulls an image. If writer is not nil, it streams progress.
func (s *ImageService) pullImage(ctx context.Context, imageWithTag string, writer io.Writer) error {
	reader, err := s.client.ImagePull(ctx, imageWithTag, types.ImagePullOptions{})
	if err != nil {
		// The context being cancelled will likely cause an error here.
		return err
	}
	defer reader.Close()

	if writer != nil {
		// Stream progress to the writer.
		s.logger.Debug("ImageService: Streaming pull progress for %s...", imageWithTag)
		err = ProcessPullProgress(reader, writer)
		if err != nil {
			s.logger.Error("ImageService: Failed to process pull progress for %s: %v", imageWithTag, err)
		} else {
			s.logger.Info("ImageService: Finished processing pull progress for %s", imageWithTag)
		}
		return err
	}

	// Wait for pull to complete without streaming progress.
	// This io.Copy will be interrupted if the context is cancelled.
	s.logger.Debug("ImageService: Waiting for pull to complete for %s...", imageWithTag)
	_, err = io.Copy(io.Discard, reader)
	if err != nil {
		s.logger.Error("ImageService: Image pull stream copy failed for %s: %v", imageWithTag, err)
	} else {
		s.logger.Debug("ImageService: Image pull stream copy finished successfully for %s", imageWithTag)
	}
	return err
}

// pruneImages removes outdated versions of an image.
func (s *ImageService) pruneImages(ctx context.Context, imageRef string) error {
	repo, tag, ok := parseImageTag(imageRef)
	if !ok {
		s.logger.Error("ImageService: Failed to parse image for pruning: %s", imageRef)
		return nil // Not a fatal error for the service itself.
	}

	// Find the ID of the target image to avoid deleting it.
	targetImage, _, err := s.client.ImageInspectWithRaw(ctx, imageRef)
	if err != nil {
		// If the target image doesn't exist, there's nothing to prune against.
		if !errors.Is(err, context.Canceled) {
			s.logger.Warn("ImageService: Target image %s not found for pruning, skipping: %v", imageRef, err)
		}
		return err
	}
	targetImageID := targetImage.ID

	// List all images with the same repository.
	filterArgs := filters.NewArgs()
	filterArgs.Add("reference", repo+":*")

	images, err := s.client.ImageList(ctx, types.ImageListOptions{
		Filters: filterArgs,
	})
	if err != nil {
		s.logger.Error("ImageService: Failed to list images for cleanup: %v", err)
		return err
	}

	for _, img := range images {
		if img.ID == targetImageID {
			continue
		}

		// Check if this image has the same repository but a different tag or is untagged but part of the same repo.
		for _, repoTag := range img.RepoTags {
			if currentRepo, currentTag := parseRepoTag(repoTag); currentRepo == repo && currentTag != tag {
				s.logger.Info("ImageService: Removing outdated image %s (ID: %s)", repoTag, img.ID[:12])
				s.removeImage(ctx, img.ID, repoTag)
			}
		}
	}
	return nil
}

func (s *ImageService) removeImage(ctx context.Context, imageID, repoTag string) {
	_, err := s.client.ImageRemove(ctx, imageID, types.ImageRemoveOptions{
		Force:         false, // Don't force remove if image is in use.
		PruneChildren: true,
	})
	if err != nil {
		s.logger.Warn("ImageService: Failed to remove outdated image %s: %v", repoTag, err)
	} else {
		s.logger.Info("ImageService: Successfully removed outdated image %s", repoTag)
	}
}

// parseRepoTag is a helper function to parse a repo:tag string.
func parseRepoTag(repoTag string) (string, string) {
	repo, tag, _ := parseImageTag(repoTag)
	return repo, tag
}