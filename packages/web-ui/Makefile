# gbox Web UI Makefile

.PHONY: help
help: ## Show this help message
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' Makefile | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install dependencies
	npm install

.PHONY: dev
dev: ## Start development server
	npm run dev

.PHONY: build
build: ## Build the application
	npm run build

.PHONY: start
start: ## Start production server
	npm run start

.PHONY: lint
lint: ## Run linter
	npm run lint

.PHONY: type-check
type-check: ## Run TypeScript type checking
	npm run type-check

.PHONY: clean
clean: ## Clean build artifacts
	rm -rf .next
	rm -rf node_modules/.cache
	rm -rf dist

.PHONY: docker-build
docker-build: ## Build Docker image
	docker build -t gbox-web-ui .

.PHONY: docker-run
docker-run: ## Run Docker container
	docker run -p 3000:3000 --env-file .env.local gbox-web-ui

.PHONY: pm2-start
pm2-start: build ## Start with PM2
	mkdir -p logs
	pm2 start ecosystem.config.js

.PHONY: pm2-stop
pm2-stop: ## Stop PM2 processes
	pm2 stop ecosystem.config.js

.PHONY: pm2-restart
pm2-restart: ## Restart PM2 processes
	pm2 restart ecosystem.config.js

.PHONY: pm2-logs
pm2-logs: ## Show PM2 logs
	pm2 logs gbox-web-ui --nostream

.PHONY: pm2-status
pm2-status: ## Show PM2 status
	pm2 status

# Default target
.DEFAULT_GOAL := help