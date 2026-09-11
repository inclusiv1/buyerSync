---
sessionId: session-260905-155835-13mu
---

# Requirements

### Goal
Implement the currently missing `npm run stop:all` command in the root `package.json`, with `npm stop` as a convenient alias, so one command terminates all frontend and API development servers used by this project.

### Functional Requirements
- Add a real, top-level `stop:all` entry under `package.json`'s `scripts` object so `npm run stop:all` no longer reports `Missing script: "stop:all"`.
- Expose a conventional `stop` alias that delegates to the same implementation.
- Stop normal development listeners on ports `5173` (Vite) and `3001` (Express).
- Stop collaborative-test listeners on ports `5174` (Vite) and `4301` (Express).
- Succeed when only some or none of the ports are active.
- Work consistently on supported developer platforms through a project dependency rather than OS-specific shell pipelines.
- Keep `Ctrl+C` as the preferred clean shutdown for a currently attached `concurrently` session.

### Scope
- Update the root npm scripts, dependency lock data, and local-development documentation.
- Do not stop optional external services such as Mailpit or independently deployed listing-import providers.
- Do not change application runtime behavior, server startup, or database state.

# Technical Design

### Current Implementation
- Verified the current root `package.json:9-25` still has neither `stop` nor `stop:all`; the submitted plan has not modified application files, so npm correctly continues to report `Missing script: "stop:all"` until this plan is implemented.
- `server/index.ts:31` defaults the API to port `3001`.
- `package.json:12` overrides test mode to API port `4301` and Vite port `5174`; normal Vite uses its default `5173` because `vite.config.ts` has no port override.
- `package-lock.json:55-59` has no direct port-killing dependency; existing `tree-kill` records are transitive and should not be invoked as an undeclared project tool.
- `README.md:61` currently documents only `Ctrl+C` shutdown.

### Proposed Changes
- Add `kill-port` as a direct development dependency and lock it in `package-lock.json`.
- Add `"stop:all": "kill-port 5173 3001 5174 4301"` to the root scripts.
- Add `"stop": "npm run stop:all"` so both `npm run stop:all` and `npm stop` use the same implementation.
- Update `README.md` local-development and test-mode guidance with `npm run stop:all` as recovery for detached/orphaned processes.
- Warn that force-stopping by port also terminates unrelated applications occupying those configured ports.

### Key Decision
Use the declared `kill-port` package rather than `lsof`/`kill`, PowerShell, or the transitive `tree-kill` package. This keeps the command cross-platform; defining the implementation once in `stop:all` avoids alias drift.

# Testing

### Validation Approach
- Confirm `npm run` lists `stop:all` and `stop`, and that invoking `npm run stop:all` no longer produces the missing-script error.
- Start temporary listeners on the four configured ports, run `npm run stop:all`, and verify each port can be rebound afterward.
- Run both `npm run stop:all` and `npm stop` with no listeners active and verify they exit without requiring manual cleanup.
- Confirm existing `npm run dev` and `npm run dev:test` script definitions remain unchanged.

### Regression Checks
- Verify `Ctrl+C` still stops both child processes launched by `concurrently`.
- Confirm the stop command does not modify `dev.db` or invoke Prisma setup.

# Delivery Steps

###   Step 1: Add the unified server stop command
`npm run stop:all` and its `npm stop` alias terminate every normal and test frontend/API listener configured by the project.

- Add `kill-port` as a direct development dependency in `package.json` and update `package-lock.json`.
- Add `"stop:all": "kill-port 5173 3001 5174 4301"` directly inside the root `scripts` object and add `"stop": "npm run stop:all"` beside it.
- Confirm both entries appear in `npm run` and preserve all existing development and production startup scripts.

###   Step 2: Document and verify shutdown behavior
Developers have clear clean-shutdown and force-stop instructions, and the command is validated against all configured ports.

- Update `README.md` to retain `Ctrl+C` as the clean shutdown path and introduce `npm run stop:all` (or `npm stop`) for detached or orphaned servers.
- Document the four targeted ports and the risk of terminating unrelated processes using them.
- Validate active, partially active, and already-free port scenarios without touching Prisma data.