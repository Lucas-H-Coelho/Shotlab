.PHONY: all test test-backend test-frontend build build-frontend lint lint-backend lint-frontend help

# Detect Python interpreter using absolute path (local .venv, parent worktree .venv, global repo .venv, or system python3)
ifneq ($(wildcard $(CURDIR)/backend/.venv/bin/python),)
    PYTHON ?= $(CURDIR)/backend/.venv/bin/python
else ifneq ($(wildcard $(abspath $(CURDIR)/../backend/.venv/bin/python)),)
    PYTHON ?= $(abspath $(CURDIR)/../backend/.venv/bin/python)
else ifneq ($(wildcard /home/rukashi/Documentos/GitHub/Shotlab/backend/.venv/bin/python),)
    PYTHON ?= /home/rukashi/Documentos/GitHub/Shotlab/backend/.venv/bin/python
else
    PYTHON ?= $(shell command -v python3 2>/dev/null || echo python)
endif

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
