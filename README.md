# UI Creator

Local-first interface engineering environment for structured, editable, interactive, and production-oriented user interfaces.

> Describe → Generate → Inspect → Edit → Validate → Preview → Export

**Current version:** `v0.6.0`  
**Schema:** `v3`  
**Status:** Active pre-1.0 development

## v0.6.0 - Runtime & Interactive Preview

Milestone 5 adds the first declarative runtime layer. The editor can now persist runtime variables and interactions while the preview executes them in isolated, ephemeral state.

### Runtime capabilities

- Runtime variables with `string`, `number`, and `boolean` types
- Declarative node events: `click`, `change`, `submit`, and `focus`
- Declarative actions:
  - `navigate`
  - `open`
  - `close`
  - `toggle`
  - `setVariable`
  - `updateVariable`
  - `submit`
  - `reset`
  - `focus`
  - `scrollTo`
- Interactive Preview mode
- Runtime-state reset without mutating the project model
- Page navigation in preview
- Runtime visibility overrides for modal/drawer-style flows
- Variable interpolation in text using `{{variableId}}`
- Runtime variable inspector in Preview
- New Form, Modal, Drawer, Toggle, and Tabs primitives
- Interaction authoring from the node Inspector
- Runtime variable management from the Runtime sidebar tab

### Safety model

UI Creator does **not** execute arbitrary JavaScript for interactions. Runtime behavior is represented as validated declarative actions and interpreted by the runtime engine.

The core boundary is:

```text
Project Model
    ↓
Runtime Definitions
    ↓
Runtime State
    ↓
Interactive Preview
```

Runtime state is temporary. It does not enter command history and never mutates persisted design state directly.

## Existing editor capabilities

- DOM-based React/Vite editor shell
- Pages and layer tree
- Resizable editor panels
- Node selection and editable Inspector
- Container, Stack, Grid, Text, Button, Input
- Form, Modal, Drawer, Toggle, Tabs
- Add, delete, duplicate, reorder, drag and resize
- Flexbox and CSS Grid controls
- Width, height, padding, margin and gap
- Typography and appearance editing
- Visibility and lock controls
- Command-based undo/redo
- Local filesystem projects
- Rolling backups and recovery
- SQLite recent-project metadata
- Local Project CRUD API

## Design system

- Design tokens
- Dark/light themes
- Theme token overrides
- Custom breakpoints
- Responsive node overrides
- Reusable components
- Component instances and local overrides

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
   └── Export
            
Project Model + Runtime Definitions
    ↓
Ephemeral Runtime State
    ↓
Interactive Preview
```

Important invariants:

- Persistent editor mutations pass through commands.
- Undo/redo applies to design/runtime definitions stored in the project.
- Live preview state is not persisted and is not added to undo history.
- Runtime actions cannot execute arbitrary JavaScript.
- Interaction targets, pages, variables, tokens, breakpoints, components, and node references are validated.
- Renderer/runtime code does not directly mutate the persisted project model.

## Project schema v3

Schema v3 formalizes typed runtime variables and declarative interaction events/actions.

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

This runs the TypeScript core build, automated tests, and the production Vite build.

## Run locally

```bash
npm run dev
```

Open:

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

### Next

`v0.7.0` will focus on production-oriented export, beginning with React + TypeScript + Tailwind and preserving the structured project model as the source.

Later milestones cover structured AI editing, change review, accessibility/UX audits, diagnostics, and release hardening.

## Development status

UI Creator is pre-`1.0`. Public contracts and project schemas can still evolve, with explicit migrations added when persisted data changes.
