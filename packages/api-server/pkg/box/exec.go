package model

// BoxExecParams represents a request to execute a command in a box
type BoxExecParams struct {
	// The command to run. Can be a single string or an array of strings
	Commands []string `json:"commands"`
	// The timeout of the command. e.g. '30s'
	Timeout string `json:"timeout,omitempty"`
	// The working directory of the command
	WorkingDir string `json:"workingDir,omitempty"`
	// The environment variables to run the command
	Envs map[string]string `json:"envs,omitempty"`

	// --- Stream-related fields (temporarily commented out) ---
	// Args     []string           `json:"args,omitempty"`
	// Stdin    bool               `json:"stdin,omitempty"`
	// Stdout   bool               `json:"stdout,omitempty"`
	// Stderr   bool               `json:"stderr,omitempty"`
	// TTY      bool               `json:"tty,omitempty"`
	// Conn     io.ReadWriteCloser `json:"-"` // Connection for streaming
}

// BoxExecResult represents the response from an exec operation
type BoxExecResult struct {
	ExitCode int    `json:"exitCode"` // Exit code of the command
	Stdout   string `json:"stdout"`   // Standard output from command execution
	Stderr   string `json:"stderr"`   // Standard error from command execution
}

// BoxRunParams represents a request to run a command in a box
type BoxRunCodeParams struct {
	Code       string            `json:"code,omitempty"`
	Language   string            `json:"language,omitempty"` // type of the code to run, e.g. "python3", "typescript", "bash"
	Argv       []string          `json:"argv,omitempty"`     // arguments to run the code
	Timeout    string            `json:"timeout,omitempty"`
	WorkingDir string            `json:"workingDir,omitempty"`
	Envs       map[string]string `json:"envs,omitempty"` // Environment variables for the command execution
}

// BoxRunCodeResult represents the response from a run operation
type BoxRunCodeResult struct {
	ExitCode int    `json:"exitCode,omitempty"` // Exit code of the command
	Stdout   string `json:"stdout,omitempty"`   // Standard output from command execution
	Stderr   string `json:"stderr,omitempty"`   // Standard error from command execution
}

// BoxExecWSParams represents parameters for executing a command via WebSocket
type BoxExecWSParams struct {
	Cmd        []string `json:"cmd"`                  // Command to execute
	Args       []string `json:"args,omitempty"`       // Arguments for the command
	TTY        bool     `json:"tty,omitempty"`        // Whether to allocate a TTY
	WorkingDir string   `json:"workingDir,omitempty"` // Working directory inside the container
}

// StreamType represents the type of stream in multiplexed output
type StreamType byte

const (
	StreamStdin  StreamType = 0 // stdin (written to stdout)
	StreamStdout StreamType = 1 // stdout
	StreamStderr StreamType = 2 // stderr

	// MediaTypeRawStream is the MIME-Type for raw TTY streams
	MediaTypeRawStream = "application/vnd.gbox.raw-stream"

	// MediaTypeMultiplexedStream is the MIME-Type for stdin/stdout/stderr multiplexed streams
	MediaTypeMultiplexedStream = "application/vnd.gbox.multiplexed-stream"
)

// StreamHeader represents the header of a multiplexed stream frame
type StreamHeader struct {
	Type StreamType // Stream type (0: stdin, 1: stdout, 2: stderr)
	Size uint32     // Size of the frame payload
}
