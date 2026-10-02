# Local GUI/UI/UX Designer & Creator

Version: `0.4.3`

Local-first structured interface engineering environment. Milestone 3 turns the editor shell into a real layout editor while preserving the canonical project-model and command boundaries.

## Milestone 3 includes

- Editable React/Vite editor shell
- Add Container, Stack, Grid, Text, Button and Input nodes
- Delete and duplicate complete subtrees
- Layer reorder via drag and drop
- Canvas drag into compatible containers
- Pointer resize with one committed command per completed resize
- Flex and Grid controls
- Width, height, padding, margin and gap controls
- Typography controls
- Background, text color and radius controls
- Visibility and lock controls
- Editable node names and basic component content
- Undo/redo through the shared command engine
- Exact deterministic redo for duplicated subtrees
- Explicit save through the local Project API
- Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+D, Ctrl/Cmd+S and Delete
- Existing Project CRUD, backups, recovery and recent-project metadata

## Requirements

- Node.js >= 22.5
- npm >= 10

## Install

```bash
npm install
```

The root package uses npm workspaces, so this single command installs both the core tooling and the React/Vite web application.

## Verify

```bash
npm run verify
```

This runs the core/integration/editor contract tests and then the production Vite build.

## Run locally

```bash
npm run dev
```

This starts the local API server and the Vite web application together. Open `http://127.0.0.1:4173`.

For debugging, they can still be started separately with `npm run dev:server` and `npm run dev:web`.

The Vite development server proxies `/api` to the local service on `127.0.0.1:4174`.

## Architectural invariant

Every persistent editor mutation is represented by a validated command. The React canvas and inspector never mutate the project model directly. Drag and resize interactions may use transient DOM feedback, but only the completed operation is committed to command history.
