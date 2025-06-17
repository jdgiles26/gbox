package docker

import (
	"fmt"

	"github.com/docker/docker/client"

	"github.com/babelcloud/gbox/packages/api-server/config"
	"github.com/babelcloud/gbox/packages/api-server/internal/box/service"
	"github.com/babelcloud/gbox/packages/api-server/internal/tracker"
	"github.com/babelcloud/gbox/packages/api-server/pkg/logger"
)

// Service implements the box service interface using Docker.
type Service struct {
	client        *client.Client
	logger        *logger.Logger
	accessTracker tracker.AccessTracker
	imageService  *ImageService
}

// NewService creates a new Docker service instance.
func NewService(tracker tracker.AccessTracker) (*Service, error) {
	cfg := config.GetInstance()
	dockerHost := cfg.Cluster.Docker.Host

	cli, err := client.NewClientWithOpts(client.WithHost(dockerHost))
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	log := logger.New()

	// Create and start ImageService.
	imageService := NewImageService(cli, log)
	imageService.Start()

	return &Service{
		client:        cli,
		logger:        log,
		accessTracker: tracker,
		imageService:  imageService,
	}, nil
}

// Close gracefully shuts down the service.
func (s *Service) Close() error {
	if s.imageService != nil {
		s.imageService.Stop()
	}
	if s.client != nil {
		return s.client.Close()
	}
	return nil
}

func init() {
	service.Register("docker", func(tracker tracker.AccessTracker) (service.BoxService, error) {
		return NewService(tracker)
	})
}