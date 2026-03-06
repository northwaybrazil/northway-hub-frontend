# Northway Hub Frontend

Agent Management frontend built with Vite + React + TypeScript.

## Overview

This app provides a management console to:

- Authenticate and keep session in browser storage.
- List, create, update, and delete agents.
- Configure:
  - `kind`: `CONVERSATIONAL` or `REPORT_GENERATOR`
  - `use_case` (only when `kind=CONVERSATIONAL`): `SDR` or `SUPPORT`
  - Handoff and cooldown settings
  - Chatwoot integration fields
- Configure intelligence settings:
  - Model selection
  - `system_prompt` (placeholder: `You are a helpful assistant.`)
  - Knowledge base metadata
- Upload and list knowledge files (when backend is available).

## Tech Stack

- React 19
- TypeScript (strict mode)
- Vite 6

## Requirements

- Node.js 18+ (recommended 20+)
- npm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Run locally:

```bash
npm run dev
```

## Environment Variables

- `VITE_API_URL`: API base URL, example `http://localhost:3000`

When this variable is empty, frontend requests use relative paths (same origin).

## Scripts

- `npm run dev`: starts Vite dev server
- `npm run build`: runs TypeScript build + production bundle
- `npm run preview`: serves built app locally

## Local Fake Login (Dev Only)

To unblock frontend development without infrastructure, local fake login is enabled automatically in **Vite dev mode** (`import.meta.env.DEV`).

### How it works

- In `npm run dev`, clicking login creates a local fake session instead of calling `POST /api/auth/login`.
- You can type any email/password to enter.
- The session is marked with token type `LOCAL_DEV_FAKE`.
- The app skips backend reads for agents/knowledge files in this mode.
- Agent create/update/delete actions run locally in memory so UI flows can be tested.

### Limitations in fake mode

- Knowledge file upload is disabled (shows an informational message).
- Local agents are not persisted as real backend data.
- Refresh keeps the fake session, but agent list starts empty again.
- This mode is for UI/dev testing only.

### Production behavior

- In non-dev builds (`npm run build` + `npm run preview` or deployed environments), login uses real backend auth and normal API flows.

## API Integration

Implemented endpoints:

- `POST /api/auth/login`
- `GET /api/agent-management/agents`
- `POST /api/agent-management/agents`
- `PATCH /api/agent-management/agents/{id}`
- `DELETE /api/agent-management/agents/{id}`
- `GET /api/knowledge/files?agentId={agentId}`
- `POST /api/knowledge/uploads`

## Payload Notes

- General save sends `kind` always.
- `use_case` is sent only when `kind=CONVERSATIONAL`.
- Chatwoot integration payload is sent only when integration fields are filled.
- Intelligence save sends `model`, `system_prompt`, and `metadata.knowledge_base` when provided.

## Project Structure

- `src/App.tsx`: main application flow, auth/session handling, local fake mode logic
- `src/api.ts`: HTTP client and API wrappers
- `src/types.ts`: shared domain types
- `src/components/agent-management/*`: UI for login, sidebar, tabs, and forms

## Notes for Contributors

- Path alias: `@components/*` -> `src/components/*`
- TypeScript is strict and blocks unused locals/params.
- Run `npm run build` before opening PRs to catch type and bundle issues.
