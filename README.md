# UI Creator

Local-first interface engineering environment for structured, editable, interactive, and production-oriented user interfaces.

> Describe → Generate → Inspect → Edit → Validate → Preview → Export

**Current version:** `v0.7.0`  
**Schema:** `v3`  
**Status:** Active pre-1.0 development

## v0.7.0 - Production Export

Milestone 6 adds a production-oriented export pipeline. The editor can now transform the validated canonical Project Model into a standalone React + TypeScript + Tailwind application and download it as a ZIP from the local server.

### Export capabilities

- One-click production export from the editor top bar
- Deterministic file generation from the canonical Project Model
- Standalone React 19 + TypeScript + Vite project
- Tailwind CSS integration through `@tailwindcss/vite`
- Exported project snapshot in typed TypeScript
- Generated declarative runtime engine
- Generated responsive renderer
- Theme/token resolution
- Breakpoint-aware responsive overrides
- Reusable component rendering and local overrides
- Runtime variables, events, actions, navigation, visibility and interpolation
- Generated README, `.gitignore`, package manifest and Vite configuration
- ZIP download from the local API
- No arbitrary JavaScript execution from project data

### Export boundary

```text
Validated Project Model
        ↓
     Exporter
        ↓
Deterministic File Map
        ↓
      ZIP Archive
        ↓
React + TypeScript + Tailwind App
```

The exporter never mutates the project. Invalid projects are rejected before code generation.

## Runtime capabilities

- Runtime variables with `string`, `number`, and `boolean` types
- Declarative node events: `click`, `change`, `submit`, and `focus`
- Declarative actions: `navigate`, `open`, `close`, `toggle`, `setVariable`, `updateVariable`, `submit`, `reset`, `focus`, `scrollTo`
- Interactive Preview mode
- Runtime-state reset without mutating persisted project data
- Page navigation and runtime visibility overrides
- Variable interpolation using `{{variableId}}`
- Form, Modal, Drawer, Toggle, and Tabs primitives

## Design system

- Design tokens
- Dark/light themes
- Theme token overrides
- Custom breakpoints
- Responsive node overrides
- Reusable components
- Component instances and local overrides

## Editor capabilities

- DOM-based React/Vite editor shell
- Pages and layer tree
- Resizable editor panels
- Node selection and editable Inspector
- Container, Stack, Grid, Text, Button, Input, Form, Modal, Drawer, Toggle, Tabs
- Add, delete, duplicate, reorder, drag and resize
- Flexbox and CSS Grid controls
- Typography and appearance editing
- Visibility and lock controls
- Command-based undo/redo
- Local filesystem projects
- Rolling backups and recovery
- SQLite recent-project metadata
- Local Project CRUD and export API

## Architecture

The canonical project model remains the single persisted source of truth.

```text
User / AI
    ↓
Validated Commands
    ↓
Project Model
   ├── Renderer
   ├── Validation
   ├── Persistence
   ├── Runtime Definitions
   └── Exporter

Project Model + Runtime Definitions
    ↓
Ephemeral Runtime State
    ↓
Interactive Preview
```

Important invariants:

- Persistent editor mutations pass through commands.
- Undo/redo applies to definitions stored in the project.
- Live preview state is ephemeral and never mutates persisted design state directly.
- Runtime actions cannot execute arbitrary JavaScript.
- Export validates the project before generation.
- Export output is deterministic for the same project input.
- Interaction targets, pages, variables, tokens, breakpoints, components, and node references are validated.

## Project schema v3

Schema v3 formalizes typed runtime variables and declarative interaction events/actions. Production export does not require a schema bump because it adds no new persisted project fields.

Legacy projects are migrated automatically:

```text
Schema v1 → Schema v2 → Schema v3
```

Schema migrations remain independent from application SemVer.

## Repository structure

```text
ui-creator/
├── apps/
│   ├── server/
│   └── web/
├── packages/
│   ├── commands/
│   ├── exporter/
│   ├── persistence/
│   ├── runtime/
│   ├── schema/
│   ├── serialization/
│   ├── shared/
│   └── validation/
├── scripts/
├── tests/
├── package.json
└── tsconfig.json
```

## Requirements

- Node.js `>= 22.5`
- npm `>= 10`

## Install

```bash
npm install
```

## Verify

```bash
npm run verify
```

This runs the TypeScript core build, automated tests, and the production editor Vite build.

## Run locally

```bash
npm run dev
```

Editor:

```text
http://127.0.0.1:4173
```

Local API:

```text
http://127.0.0.1:4174
```

The services can also be started independently:

```bash
npm run dev:server
npm run dev:web
```

## Export

With the local server connected, use **Export** in the top bar. UI Creator downloads a standalone ZIP containing the generated application.

Inside the exported project:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Shift + Z` |
| Duplicate | `Ctrl/Cmd + D` |
| Save | `Ctrl/Cmd + S` |
| Delete selected node | `Delete` |

## Roadmap

### Completed foundations

- `v0.1.0` Foundation
- `v0.2.0` Local Projects
- `v0.3.0` Editor Shell
- `v0.4.0` Layout Editing
- `v0.5.0` Design System
- `v0.6.0` Runtime & Interactive Preview
- `v0.7.0` Production Export

### Next

`v0.8.0` will focus on structured AI generation and editing, including provider abstraction, dry-run validation, change review, and explicit apply/reject control.

Later milestones cover accessibility/UX audits, diagnostics, performance hardening, and the stable `v1.0.0` release.

## Development status

UI Creator is pre-`1.0`. Public contracts and project schemas can still evolve, with explicit migrations added when persisted data changes.
