# gbox Web UI

A modern web interface for managing and interacting with gbox AI agent sandboxes.

## Features

- **Box Management**: Create, start, stop, and delete Linux and Android sandbox containers
- **Interactive Terminal**: Full-featured terminal with WebSocket connectivity to sandbox containers
- **File Explorer**: Browse and manage files within sandbox containers
- **Computer Use Agent (CUA)**: AI-powered automation interface for complex tasks
- **Real-time Monitoring**: Live status updates and system metrics
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom components
- **Terminal**: xterm.js with WebSocket support
- **State Management**: React hooks and context
- **API Client**: Axios with TypeScript interfaces
- **Icons**: Lucide React
- **UI Components**: Radix UI primitives

## Development

### Prerequisites

- Node.js 18 or later
- npm or yarn package manager
- gbox API server running on localhost:8080

### Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Development with gbox API Server

Make sure the gbox API server is running:

```bash
# From the project root
make api-dev
```

The web UI will proxy API requests to `http://localhost:8080` by default.

## Production Deployment

### Using PM2

1. Build the application:
```bash
npm run build
```

2. Start with PM2:
```bash
make pm2-start
```

3. Monitor:
```bash
make pm2-status
make pm2-logs
```

### Using Docker

1. Build the Docker image:
```bash
make docker-build
```

2. Run the container:
```bash
make docker-run
```

### Using Docker Compose

From the project root:

```bash
docker-compose -f docker-compose.web.yml up
```

This will start both the API server and web UI with an nginx reverse proxy.

## Configuration

### Environment Variables

- `GBOX_API_URL` - URL of the gbox API server (default: http://localhost:8080)
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Port to run the web server on (default: 3000)

### API Integration

The web UI communicates with the gbox API server through:

- REST API calls for CRUD operations
- WebSocket connections for real-time terminal sessions
- Server-Sent Events (SSE) for CUA task execution streams

## Architecture

### Components Structure

```
components/
├── ui/           # Reusable UI components (buttons, cards, etc.)
├── header.tsx    # Main application header
├── sidebar.tsx   # Navigation sidebar
├── box-grid.tsx  # Sandbox box management grid
├── terminal.tsx  # Interactive terminal component
├── file-explorer.tsx  # File browser and manager
└── cua-interface.tsx  # Computer Use Agent interface
```

### Hooks

- `use-boxes.ts` - Box management operations
- `use-terminal.ts` - Terminal connection and control

### API Client

The `lib/api.ts` module provides a typed API client with methods for:

- Box lifecycle management
- Command execution
- File system operations
- Browser automation
- Computer Use Agent tasks

## Features Overview

### Box Management
- Create Linux and Android sandbox containers
- View real-time status and resource usage
- Start, stop, and delete containers
- Quick actions and bulk operations

### Interactive Terminal
- Full xterm.js terminal with WebSocket connectivity
- Real-time command execution
- Terminal history and session persistence
- Copy/paste support and customizable themes

### File Explorer
- Browse container file systems
- Upload and download files
- Create and delete files/folders
- File content editing (planned)

### Computer Use Agent (CUA)
- Natural language task descriptions
- AI-powered automation execution
- Real-time execution monitoring
- Task history and logging

## Browser Compatibility

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

Please follow the existing code style and ensure all tests pass.

## License

Apache License 2.0 - see the main project LICENSE file for details.