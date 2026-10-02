# UI Creator

Local-first interface engineering environment for designing structured, editable, and production-oriented user interfaces.

> Design interfaces as systems, not screenshots.

**Current version:** `v0.5.0`  
**Status:** Active development  
**Platform:** Local web application  
**Primary stack:** React, TypeScript, Vite, Node.js

## Overview

UI Creator is a structured GUI/UI/UX design environment rather than a pixel-only mockup tool.

The project uses one canonical project model across the editor, validation, persistence, runtime, future AI tooling, and export pipeline. Persistent changes are represented as validated commands so operations remain inspectable, reversible, and deterministic where practical.

The long-term workflow is:

```text
Describe → Generate → Inspect → Edit → Validate → Preview → Export
```

## Milestone 4 - Design System

`v0.5.0` adds the first complete design-system layer on top of the layout editor.

### Design tokens

- Central token registry
- Color, spacing, radius, typography, shadow, border, opacity, breakpoint, z-index, and motion categories
- Literal values and token references remain distinct in the project model
- Token selection directly from the Inspector
- Create, update, and delete token controls
- Referenced tokens cannot be deleted
- Token deletion is exactly reversible, including theme overrides

### Themes

- Dark and Light defaults
- Create additional themes
- Select or disable the active theme
- Per-token theme overrides
- Reset individual overrides back to base token values
- Active themes cannot be deleted accidentally

### Responsive design

- Project-level breakpoints
- Create, update, and delete breakpoints
- Base styles plus breakpoint-specific overrides
- Responsive Canvas viewport selector
- Cascading breakpoint resolution
- Breakpoints still referenced by nodes cannot be deleted

### Reusable components

- Convert a selected subtree into a reusable component definition
- Definition subtrees are detached from page trees
- Insert component instances into pages
- Component instances share their source definition
- Instance-local property, style, visibility, and responsive overrides
- Definitions cannot be deleted while instances still reference them

### Compatibility

Project schema is now **Schema v2**.

Schema v1 projects are migrated automatically when loaded. Existing project data is preserved while missing default design-system tokens, themes, and breakpoints are added.

## Existing capabilities

### Editor

- React/Vite editor shell
- DOM-based design canvas
- Pages and layer tree
- Resizable editor panels
- Node selection
- Editable inspector
- Add Container, Stack, Grid, Text, Button, and Input nodes
- Delete and duplicate complete subtrees
- Layer reorder via drag and drop
- Canvas drag into compatible containers
- Pointer-based resize
- Visibility and lock controls

### Layout and styling

- Flexbox
- CSS Grid
- Width and height
- Padding, margin, and gap
- Typography
- Background color
- Text color
- Border radius
- Basic component content editing

### Project engine

- Canonical Project Schema v2
- Validated command-based mutations
- Undo/redo
- Deterministic serialization
- Sequential schema migration harness
- Atomic local persistence
- Rolling backups
- Recovery from valid backups
- Recent-project metadata through SQLite
- Local Project CRUD API

## Architecture

```text
                    User
                     │
                     ▼
                  Commands
                     │
                     ▼
               Project Model
                /    |     \
               /     |      \
          Renderer Runtime Validation
               \     |      /
                \    |     /
             Persistence / Export
```

The project model is the single source of truth.

Key invariants:

- React components do not directly mutate persistent project state.
- Persistent editor mutations pass through validated commands.
- Renderer logic is read-only with respect to the project model.
- Drag and resize may use transient visual state, but only completed operations enter history.
- Project files remain portable and filesystem-oriented.
- Schema migrations are sequential and validated.
- AI-generated changes, once implemented, will use the same validated mutation path as manual edits.

## Repository structure

```text
ui-creator/
├── apps/
│   ├── server/
│   └── web/
├── packages/
│   ├── commands/
│   ├── persistence/
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

The root package uses npm workspaces, so one install covers both the core tooling and the React/Vite web application.

## Verify

```bash
npm run verify
```

Verification runs the TypeScript core build, automated core/integration/editor tests, and the production Vite build.

## Run locally

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173
```

The local API service runs on:

```text
http://127.0.0.1:4174
```

The services can also be started separately:

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

## Verification status

The packaged `v0.5.0` source passes **25/25 core, integration, persistence, migration, command, and editor contract tests** in the build environment.

The React/Vite source also passes an isolated TypeScript contract check. A full local Vite production build still requires the npm dependencies to be installed with `npm install`.

## Roadmap

### `v0.6.0` - Runtime

- Runtime variables
- Component states
- Events and actions
- Navigation
- Modal and drawer state
- Forms
- Interactive preview mode

### Later milestones

- React + TypeScript + Tailwind export
- Structured AI generation and editing
- AI change review
- UX audit
- Accessibility audit
- Diagnostics and performance tooling

## Product direction

UI Creator is intended to become a **local interface engineering environment** that connects:

```text
Idea
 ↓
Structure
 ↓
Design System
 ↓
Interface
 ↓
Interaction
 ↓
Validation
 ↓
Preview
 ↓
Production Code
```

The goal is not to replace general-purpose graphics tools. The focus is structured interfaces that remain editable, testable, reversible, and technically useful.

## Development status

The project is pre-`1.0` and under active development. Public contracts and project schemas may evolve until the stable release, with migrations added where appropriate.
