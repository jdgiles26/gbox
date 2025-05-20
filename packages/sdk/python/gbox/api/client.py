"""
GBox Low-Level API Client Module
"""

import json
import logging  # Import logging
from typing import Any, Dict, Optional, Tuple, Union, BinaryIO, Callable
from urllib.parse import urljoin
import io
import struct
import threading
import socket

import requests

# Import custom exceptions from the parent directory
from ..exceptions import APIError, ConflictError, NotFound


class Client:
    """
    Low-level HTTP client for communicating with the GBox API server.
    Handles making requests and basic error handling based on status codes.
    """

    def __init__(self, base_url: str, timeout: int = 60, logger: Optional[logging.Logger] = None):
        """
        Initialize client.

        Args:
            base_url: Base URL of the GBox API server.
            timeout: Default request timeout in seconds.
            logger: Optional logger instance.
        """
        if not base_url:
            raise ValueError("base_url cannot be empty")
        self.base_url = base_url
        self.timeout = timeout
        self.logger = logger or logging.getLogger(__name__)  # Use provided logger or default
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    def _log(self, level: str, message: str, *args: Any, **kwargs: Any) -> None:
        """
        Log message using the configured logger.
        """
        if self.logger:
            log_method = getattr(
                self.logger, level, self.logger.debug
            )  # Default to debug if level invalid
            try:
                log_method(message, *args, **kwargs)
            except Exception as e:
                # Fallback logging in case of issues with the primary logger
                print(f"LOGGING FAILED [{level.upper()}]: {message} - Error: {e}")

    def _raise_for_status(self, response: requests.Response) -> None:
        """
        Raises appropriate GBoxError based on response status code.
        """
        try:
            error_data = response.json()
            message = error_data.get("message", response.reason)
            explanation = error_data.get("explanation")  # Check for explanation field
        except json.JSONDecodeError:
            message = response.text or response.reason  # Use text if JSON fails
            explanation = None
        except Exception as e:  # Catch other potential parsing errors
            message = f"Failed to parse error response: {e}"
            explanation = response.text

        status_code = response.status_code

        if status_code == 404:
            self._log(
                "warning", f"Request failed (NotFound): {status_code} {message} {explanation or ''}"
            )
            raise NotFound(message, status_code=status_code, explanation=explanation)
        elif status_code == 409:
            self._log(
                "warning", f"Request failed (Conflict): {status_code} {message} {explanation or ''}"
            )
            raise ConflictError(message, status_code=status_code, explanation=explanation)
        elif 400 <= status_code < 500:
            # General client error
            self._log(
                "warning",
                f"Request failed (Client Error): {status_code} {message} {explanation or ''}",
            )
            raise APIError(message, status_code=status_code, explanation=explanation)
        elif 500 <= status_code < 600:
            # General server error
            self._log(
                "warning",
                f"Request failed (Server Error): {status_code} {message} {explanation or ''}",
            )
            raise APIError(message, status_code=status_code, explanation=explanation)
        # If no exception is raised, the status code is considered OK.

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[Union[float, Tuple[float, float]]] = None,
        raw_response: bool = False,
    ) -> Any:
        """
        Send HTTP request to API server.

        Args:
            method: HTTP method (GET, POST, PUT, etc.)
            path: API path (relative to base_url)
            params: URL query parameters
            data: Request body data
            headers: Request headers
            timeout: Request timeout (overrides default if provided)
            raw_response: If True, return the raw response content instead of parsing JSON

        Returns:
            Parsed JSON response data, raw response content (if raw_response=True),
            or None for 204 status.

        Raises:
            APIError: For 4xx/5xx errors from the server.
            NotFound: For 404 errors.
            ConflictError: For 409 errors.
            GBoxError: For connection errors or other request issues.
        """
        url = urljoin(self.base_url, path.lstrip("/"))  # Ensure path doesn't start with /
        request_headers = self.session.headers.copy()  # Start with session defaults
        if headers:
            request_headers.update(headers)

        # Determine if data is binary based on Content-Type header
        content_type = request_headers.get("Content-Type", "application/json").lower()
        is_binary = "application/json" not in content_type

        request_data = data
        if data is not None and not is_binary:
            try:
                request_data = json.dumps(data)
            except TypeError as e:
                raise TypeError(f"Failed to serialize data to JSON: {e}. Data: {data}") from e

        # Use provided timeout or the client's default
        current_timeout = timeout if timeout is not None else self.timeout

        self._log("debug", f"Request: {method} {url}")
        if params:
            self._log("debug", f"  Query Params: {params}")
        # Avoid logging potentially large binary data
        if request_data and not is_binary:
            # Log potentially sensitive data carefully
            log_data = str(request_data)
            if len(log_data) > 500:  # Truncate long data
                log_data = log_data[:500] + "..."
            self._log("debug", f"  Body: {log_data}")
        elif is_binary and data is not None:
            self._log("debug", "  Body: <binary data>")
        if request_headers != self.session.headers:  # Log only if different from default
            self._log("debug", f"  Headers: {request_headers}")

        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                data=request_data,
                headers=request_headers,
                timeout=current_timeout,
            )

            self._log(
                "info" if response.ok else "warning",
                f"Response: {response.status_code} {response.reason} ({response.url})",
            )

            # Raise custom exceptions for bad status codes
            self._raise_for_status(response)

            # Process successful response
            if raw_response:
                return response.content

            if response.status_code == 204 or not response.content:
                return None  # No content

            # Try to parse as JSON, return raw bytes if it fails (might be tar, etc.)
            try:
                return response.json()
            except json.JSONDecodeError:
                self._log("debug", "Response is not JSON, returning raw content.")
                return response.content  # Return raw bytes if not JSON

        except requests.exceptions.Timeout as e:
            self._log("error", f"Request timed out: {method} {url} after {current_timeout}s")
            raise APIError(f"Request timed out after {current_timeout}s", status_code=408) from e
        except requests.exceptions.ConnectionError as e:
            self._log("error", f"Connection error: {method} {url} - {e}")
            raise APIError(f"Connection error to {self.base_url}", status_code=503) from e
        except requests.RequestException as e:
            # Catch other requests exceptions (e.g., TooManyRedirects)
            self._log("error", f"Request failed: {method} {url} - {e}")
            # Use a generic status code or leave it None if unclear
            raise APIError(
                f"Request failed: {e}", status_code=getattr(e.response, "status_code", None)
            ) from e
        # Fix: Catch specific known SDK errors first to prevent re-wrapping
        except (NotFound, ConflictError, APIError) as e:
            # Let specific SDK errors raised by _raise_for_status pass through
            raise e
        except Exception as e:
            # Catch truly unexpected errors during request processing
            self._log(
                "error", f"Unexpected error during request: {method} {url} - {e}", exc_info=True
            )
            raise APIError(f"An unexpected error occurred: {e}") from e

    def websocket_upgrade(
        self,
        endpoint: str,
        data: Any,
        headers: Optional[Dict[str, str]] = None,
        tty: bool = False,
        stdin: Optional[Union[str, BinaryIO]] = None,
        stream_handler: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Perform HTTP connection upgrade for websocket-like streaming connections.
        Used for interactive streaming endpoints like exec.
        
        Args:
            endpoint: API endpoint path
            data: Request data to send (will be JSON encoded)
            headers: Additional headers to send with request
            tty: Whether TTY mode is enabled
            stdin: Optional stdin input (string or file-like object)
            stream_handler: Optional custom stream handler function
            
        Returns:
            A dictionary containing stream objects or results 
            from the communication.
        
        Raises:
            APIError: If upgrading the connection fails
        """
        import http.client
        
        # Parse the URL to get host and port
        url_parts = self.base_url.split("://")
        if len(url_parts) > 1:
            host_port = url_parts[1].split("/")[0]
        else:
            host_port = url_parts[0].split("/")[0]
            
        host, port = host_port.split(":") if ":" in host_port else (host_port, "80")
        
        # Determine media type based on TTY mode
        media_type = "application/vnd.gbox.raw-stream" if tty else "application/vnd.gbox.multiplexed-stream"
        
        # Create base headers
        request_headers = {
            "Content-Type": "application/json",
            "Accept": media_type,
            "Upgrade": "tcp",
            "Connection": "Upgrade"
        }
        
        # Add custom headers if provided
        if headers:
            request_headers.update(headers)
        
        self._log("debug", f"WebSocket upgrade request to: {endpoint}")
        self._log("debug", f"Request data: {json.dumps(data, indent=2)}")
        self._log("debug", f"Request headers: {request_headers}")
        
        # Create HTTP connection
        conn = http.client.HTTPConnection(host, int(port))
        
        try:
            # Send request
            conn.request('POST', endpoint, json.dumps(data), request_headers)
            
            # Get response
            response = conn.getresponse()
            self._log("debug", f"Response status: {response.status}")
            self._log("debug", f"Response headers: {dict(response.getheaders())}")
            
            # Check response status
            if response.status not in (200, 101):
                error_message = f"Server returned status code {response.status}"
                try:
                    response_body = response.read()
                    error_data = json.loads(response_body.decode('utf-8'))
                    if isinstance(error_data, dict) and 'message' in error_data:
                        error_message = error_data['message']
                except Exception:
                    pass
                raise APIError(error_message, status_code=response.status)
            
            # Get the raw socket
            sock = response.fp.raw._sock
            
            # Create buffer streams for stdout and stderr
            stdout_buffer = io.BytesIO()
            stderr_buffer = io.BytesIO()
            
            # Lock for thread safety
            lock = threading.Lock()
            
            # For storing exit code
            exit_code_container = {'value': None, 'set': False}
            exit_code_event = threading.Event()
            
            # Define stdout and stderr streams with read method
            class StreamWrapper:
                def __init__(self, buffer, stream_lock):
                    self.buffer = buffer
                    self.lock = stream_lock
                    self.closed = False
                    self.position = 0
                
                def read(self, size=-1):
                    with self.lock:
                        self.buffer.seek(self.position)
                        data = self.buffer.read(size)
                        self.position = self.buffer.tell()
                        return data
                
                def close(self):
                    self.closed = True
            
            stdout_stream = StreamWrapper(stdout_buffer, lock)
            stderr_stream = StreamWrapper(stderr_buffer, lock)
            
            # Thread function for handling streams
            def handle_streams():
                nonlocal exit_code_container
                
                try:
                    if tty:
                        # Handle raw stream (TTY mode)
                        while True:
                            try:
                                # Read from connection
                                data = sock.recv(4096)
                                if not data:
                                    break
                                with lock:
                                    stdout_buffer.write(data)
                            except Exception as e:
                                self._log("error", f"Error in raw stream: {e}")
                                break
                    else:
                        # Handle multiplexed stream (non-TTY mode)
                        while True:
                            try:
                                # Read 8-byte header
                                header = sock.recv(8)
                                if not header or len(header) < 8:
                                    break

                                # Parse header
                                stream_type = header[0]
                                size = struct.unpack('>I', header[4:])[0]

                                # Read payload
                                if size > 0:
                                    payload = sock.recv(size)
                                    if not payload:
                                        break

                                    # Write to appropriate output
                                    with lock:
                                        if stream_type == 1:  # stdout
                                            stdout_buffer.write(payload)
                                        elif stream_type == 2:  # stderr
                                            stderr_buffer.write(payload)
                                        # Added: Check exit_code (stream_type == 3)
                                        elif stream_type == 3 and size == 4:  # exit code (4-byte integer)
                                            exit_code = struct.unpack('>i', payload)[0]
                                            exit_code_container['value'] = exit_code
                                            exit_code_container['set'] = True
                                            self._log("debug", f"Got exit code: {exit_code}")
                            except Exception as e:
                                self._log("error", f"Error reading from multiplexed stream: {e}")
                                break
                finally:
                    # When exiting the stream handling thread, if no exit code was obtained, try to get it from the API
                    if not exit_code_container['set']:
                        try:
                            # After the connection is closed, try to send a request to the server to get the exit code
                            # Note: This is a simple fallback method that may not be suitable for all situations
                            self._log("debug", "Stream closed without exit code, trying to get exit code from API...")
                            exit_code_container['value'] = 0  # Temporarily keep default value as 0
                            exit_code_container['set'] = True
                        except Exception as e:
                            self._log("error", f"Failed to get exit code after stream closed: {e}")
                            exit_code_container['value'] = 0
                            exit_code_container['set'] = True
                    
                    exit_code_event.set()
                    
                    try:
                        sock.close()
                    except:
                        pass
            
            # Thread function for handling stdin
            def handle_stdin():
                try:
                    if isinstance(stdin, str):
                        # If stdin is a string, send it directly
                        sock.send(stdin.encode())
                    elif stdin is not None:
                        # Read from stdin file-like object
                        while True:
                            data = stdin.read(4096)
                            if not data:
                                break
                            if isinstance(data, str):
                                data = data.encode()
                            sock.send(data)
                    # Signal EOF
                    try:
                        sock.shutdown(socket.SHUT_WR)
                    except:
                        pass
                except Exception as e:
                    self._log("error", f"Error sending stdin: {e}")
            
            # Use custom stream handler if provided
            if stream_handler:
                return stream_handler(sock, tty, stdin)
            
            # Start stream handling thread
            stream_thread = threading.Thread(target=handle_streams)
            stream_thread.daemon = True
            stream_thread.start()
            
            # Start stdin thread if needed
            stdin_thread = None
            if stdin is not None:
                stdin_thread = threading.Thread(target=handle_stdin)
                stdin_thread.daemon = True
                stdin_thread.start()
            
            # Exit code future
            class ExitCodeFuture:
                def result(self, timeout=None):
                    nonlocal exit_code_container, exit_code_event
                    if exit_code_event.wait(timeout):
                        return exit_code_container['value']
                    raise TimeoutError("Timed out waiting for exit code")
            
            exit_code_future = ExitCodeFuture()
            
            return {
                "stdout": stdout_stream,
                "stderr": stderr_stream,
                "exit_code": exit_code_future
            }
        
        except Exception as e:
            if not isinstance(e, APIError):
                e = APIError(f"WebSocket upgrade failed: {e}")
            conn.close()
            raise e

    def get(self, path: str, **kwargs: Any) -> Any:
        """Send GET request"""
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> Any:
        """Send POST request"""
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs: Any) -> Any:
        """Send PUT request"""
        return self.request("PUT", path, **kwargs)

    def delete(self, path: str, **kwargs: Any) -> Any:
        """Send DELETE request"""
        return self.request("DELETE", path, **kwargs)

    def head(self, path: str, **kwargs: Any) -> Dict[str, Any]:
        """
        Send HEAD request. Returns response headers.

        Raises:
            APIError, NotFound, etc. if the HEAD request fails.
        """
        url = urljoin(self.base_url, path.lstrip("/"))
        current_timeout = kwargs.get("timeout", self.timeout)
        headers = kwargs.get("headers")
        params = kwargs.get("params")

        self._log("debug", f"Request: HEAD {url}")
        if params:
            self._log("debug", f"  Query Params: {params}")
        if headers:
            self._log("debug", f"  Headers: {headers}")

        try:
            response = self.session.head(
                url=url,
                params=params,
                headers=headers,
                timeout=current_timeout,
                allow_redirects=True,  # Typically allow redirects for HEAD
            )

            self._log(
                "debug" if response.ok else "warning",
                f"Response: {response.status_code} {response.reason} ({response.url})",
            )

            # Raise exceptions for bad status codes
            self._raise_for_status(response)

            # Return headers as a case-insensitive dict-like object
            return response.headers

        except requests.exceptions.Timeout as e:
            self._log("error", f"HEAD Request timed out: HEAD {url} after {current_timeout}s")
            raise APIError(
                f"HEAD Request timed out after {current_timeout}s", status_code=408
            ) from e
        except requests.exceptions.ConnectionError as e:
            self._log("error", f"Connection error: HEAD {url} - {e}")
            raise APIError(f"Connection error to {self.base_url}", status_code=503) from e
        except requests.RequestException as e:
            self._log("error", f"HEAD Request failed: HEAD {url} - {e}")
            raise APIError(
                f"HEAD Request failed: {e}", status_code=getattr(e.response, "status_code", None)
            ) from e
        # Fix: Catch specific known SDK errors first to prevent re-wrapping
        except (NotFound, ConflictError, APIError) as e:
            # Let specific SDK errors raised by _raise_for_status pass through
            raise e
        except Exception as e:
            # Catch truly unexpected errors during request processing
            # Attempt to get status code only for *unexpected* errors
            status_code = getattr(getattr(e, "response", None), "status_code", None)
            self._log(
                "error", f"Unexpected error during HEAD request: HEAD {url} - {e}", exc_info=True
            )
            # Pass status_code if found
            raise APIError(
                f"An unexpected error occurred during HEAD request: {e}", status_code=status_code
            ) from e
