# GBox Python SDK

[![PyPI version](https://badge.fury.io/py/gbox.svg)](https://badge.fury.io/py/gbox) <!-- Placeholder: Add actual badges if/when available -->
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Official Python SDK for GBox.

GBox provides a self-hostable sandbox environment designed for AI agents, offering capabilities like terminal access, file management, and browser interaction. \
This SDK allows Python applications to programmatically manage GBox resources, primarily the execution environments (Boxes) and the shared file volume, enabling seamless integration with agent workflows.

## Installation

Make sure you have Python >= 3.7 installed.

```bash
pip install pygbox
```

The SDK requires the following core dependencies:
*   `requests>=2.25.0`
*   `pydantic>=2.0`

## Basic Usage

### Initialize the client

Initialize the client, pointing it to your self-hosted GBox server:

```python
from gbox import GBoxClient

# Initialize the client (defaults to http://localhost:28080)
# Use base_url to specify a different server address
gbox = GBoxClient(base_url="your-gbox-server-address")
```

The `GBoxClient` can be configured during initialization:

*   `base_url` (str): The base URL for the GBox API server (e.g., `"http://my-gbox-server:28080"`).
*   `timeout` (int): The default request timeout in seconds (default: 60).
*   `config` (GBoxConfig): An instance of `gbox.config.GBoxConfig` for more advanced configuration (e.g., custom logger).


The client provides access to managers for different resources:

*   `gbox.boxes`: For managing Box instances.
*   `gbox.files`: For interacting with the shared file volume.

### Box Management
Create a box with a specific image, labels and other configurations.
```python
# --- Create a box with a specific image, labels and other configurations ---
box = gbox.boxes.create(image="python:3.11-slim", labels={"purpose": "sdk_demo"})

# --- Get a box by ID ---
box = gbox.boxes.get(box_id)

# --- List all boxes ---
boxes = gbox.boxes.list()

# --- Delete all boxes ---
gbox.boxes.delete_all()
```

### Box Lifecycle and Usage
Manage the lifecycle of a box.
```python
# --- Start a box ---
box.start()

# --- Stop a box ---
box.stop()

# --- Update status of a box ---
box.reload()

# --- Delete a box ---
box.delete()
```

Run command in a box.
```python
# --- Run a command in a box ---
exit_code_ls, stdout_ls, stderr_ls = box.run(["ls", "-l"])

# --- Run a command in a box ---
box.run(["touch", "app.py"])
```

Execute command with interactive streaming support.
```python
# Execute command with streaming I/O
process = box.exec(
    command=["cat", "/etc/hosts"],
    stdin=None,
    tty=False,
    working_dir="/tmp"
)
# process is a dict with keys: stdout, stderr, exit_code
```


Copy file between box and local directory.
```python
local_copy_source = "demo_copy_local_to_box.txt"
box_copy_target = "box:/tmp/copied_from_local.txt"

box.copy(source=local_copy_source, target=box_copy_target)

box_copy_source = f"box:/tmp/demo_upload.txt"
local_copy_target = "./downloaded_from_box.txt"

box.copy(source=box_copy_source, target=local_copy_target)
```
### Files (Shared Volume)
Interact with files stored in the GBox shared volume using `gbox.files`.
```python
from gbox import GBoxClient, NotFound, APIError # Assuming necessary imports

# (Assume gbox client is initialized: gbox = GBoxClient())
# (Assume a box object exists: box = gbox.boxes.get("your_box_id"))
# (Assume '/shared/data/my_file.txt' exists in the shared volume)
# (Assume '/app/output.log' exists inside the 'box')

file_path_shared = "/shared/data/my_file.txt" # Path in the shared volume
file_path_in_box = "/app/output.log"         # Path inside the specific box
box_id = box.id                              # Get box ID from the box object

# --- Basic File Operations (Shared Volume) ---

# Check if a file exists
file_exists = gbox.files.exists(file_path_shared)

if file_exists:
    try:
        # Get the File object
        file_obj = gbox.files.get(file_path_shared)

        # Read content (binary)
        content_bytes = file_obj.read()

        # Read content (text, assuming UTF-8)
        content_text = file_obj.read_text()

# --- Sharing Files from a Box ---

try:
    # Share using the box ID
    shared_file_from_id = gbox.files.share_from_box(box_id, file_path_in_box)

    # Or share using the Box object directly
    shared_file_from_obj = gbox.files.share_from_box(box, file_path_in_box)

    # Now 'shared_file_from_obj' can be used to read the shared file's content
    # e.g., shared_content = shared_file_from_obj.read_text()


# --- File Reclamation (Cleanup) ---

reclaim_result = gbox.files.reclaim()
```

## License
This SDK is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

