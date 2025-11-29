# Repository Guidelines

## Project Structure & Module Organization
`backend/` runs the Express + Claude Agent SDK service (server, routes, process/database helpers) while `frontend/` (Vite + React + TypeScript) holds UI code in `src/components` with shared types in `src/types.ts`. Root scripts (`package.json`, `start-debug.sh`, `test-ai-creation.sh`) coordinate both apps, `.claude/` stores editable project catalogs, and `.env*` carries secrets. Keep reference docs in `docs/` (notably `docs/ARCHITECTURE.md`) and cap new modules near 200 lines by extracting shared HTTP or process helpers into dedicated utility files.

## Build, Test, and Development Commands
Run `npm run install:all` after cloning to bootstrap both apps. `npm run dev` serves backend (http://localhost:9999) and frontend (http://localhost:5173) together; `npm run dev:backend` or `npm run dev:frontend` isolate either side. `npm run build` compiles the Vite bundle and `npm run start` hosts the packaged UI from the backend. Reach for `start-debug.sh` for the prewired debugger and `test-ai-creation.sh` to exercise the scripted Claude-agent flow.

## Coding Style & Naming Conventions
Code is TypeScript-first with 2-space indentation, semicolons, and single quotes, matching the current React components and backend services. Use PascalCase for components/types, camelCase for functions and variables, and UPPER_SNAKE_CASE for constants. Avoid `any`, colocate `interface` declarations near their usage, and add short comments only when logic isn't self-explanatory. Keep hooks and API clients pure and delegate process control to backend helpers to preserve separation of concerns.

## Testing Guidelines
Automated unit tests are sparse, so pair targeted manual verification with the `test-ai-creation.sh` regression script for agent flows. Add new frontend specs under `frontend/src/__tests__` (Vitest + React Testing Library) and backend specs under `backend/tests` (Jest or Node test runner), mirroring filenames like `ProjectCard.spec.tsx`. Document reproduction steps and include logs or `lsof` output in PRs whenever process state is relevant.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat(ui):`, `fix(api):`, `docs(readme):`) with <72-character subjects, and name branches `feature/*`, `fix/*`, or `docs/*` per scope. Each PR should summarize intent, cite related issues, list the commands used for verification, and include screenshots or GIFs for UI adjustments. Rebase on `main`, confirm docs/tests updates, and call out any touch points with `.claude/projects.json` or environment settings.

## Security & Configuration Notes
Never commit populated `.env` files or real `.claude/projects.json`; rely on the `.example` templates. Code that reads Anthropic credentials must honor `process.env.ANTHROPIC_API_KEY` and surface config issues via `/api/config`. For process work, guard child-process calls with path validation and reuse the wrappers in `backend/processManager.js` to avoid injection bugs.
