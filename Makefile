.PHONY: all test test-backend test-frontend build build-frontend lint lint-backend lint-frontend help

# Detect Python interpreter (local .venv, workspace .venv, or system python3)
PYTHON ?= $(shell \
	if [ -f backend/.venv/bin/python ]; then echo "backend/.venv/bin/python"; \
	elif [ -f ../backend/.venv/bin/python ]; then echo "../backend/.venv/bin/python"; \
	elif [ -f /home/rukashi/Documentos/GitHub/Shotlab/backend/.venv/bin/python ]; then echo "/home/rukashi/Documentos/GitHub/Shotlab/backend/.venv/bin/python"; \
	elif command -v python3 >/dev/null 2>&1; then echo "python3"; \
	else echo "python"; fi)

all: lint test build

help:
	@echo "Available targets:"
	@echo "  make test           - Run all tests (backend and frontend)"
	@echo "  make test-backend   - Run backend test suite (pytest)"
	@echo "  make test-frontend  - Run frontend test suite (vitest)"
	@echo "  make lint           - Run all linters and typechecks (ruff and tsc)"
	@echo "  make lint-backend   - Run backend linter (ruff)"
	@echo "  make lint-frontend  - Run frontend typecheck (tsc --noEmit)"
	@echo "  make build          - Build frontend production bundle"

test: test-backend test-frontend

test-backend:
	cd backend && $(PYTHON) -m pytest -v

test-frontend:
	cd frontend && npx vitest run

lint: lint-backend lint-frontend

lint-backend:
	cd backend && $(PYTHON) -m ruff check .

lint-frontend:
	cd frontend && npx tsc --noEmit

build: build-frontend

build-frontend:
	cd frontend && npm run build
