help: # Show help

build: # Build the project
	pnpm build

e2e-test: # Run the tests
# check if server is running
	if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:28080/api/v1/boxes | grep -q 200; then
		echo "Server is not running, please start the server first"
		exit 1
	fi
	pnpm test

dist: # Build the project
	pnpm build
