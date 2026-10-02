# UI Creator

Local-first interface engineering environment for designing structured, editable, and production-oriented user interfaces.

> Design interfaces as systems, not screenshots.

**Current version:** `v0.4.3`  
**Status:** Active development  
**Platform:** Local web application  
**Primary stack:** React, TypeScript, Vite, Node.js

## Overview

UI Creator is being built as a structured GUI/UI/UX design environment rather than a pixel-only mockup tool.

The project uses a canonical project model shared across the editor, validation, persistence, runtime, future AI tooling, and export pipeline. Persistent changes are represented as validated commands so operations remain inspectable, reversible, and deterministic where practical.

The long-term workflow is:

```text
Describe → Generate → Inspect → Edit → Validate → Preview → Export
```

The current milestone focuses on the visual editor and layout foundation.

## Current capabilities

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

- Canonical Project Schema v1
- Validated command-based mutations
- Undo/redo
- Deterministic serialization
- Project migrations foundation
- Atomic local persistence
- Rolling backups
- Recovery from valid backups
- Recent-project metadata through SQLite
- Local Project CRUD API

### Quality

- Structural validation
- Parent/child consistency checks
- Cycle prevention
- Broken-reference detection
- Deterministic duplicate redo
- Core, integration, persistence, API, and editor contract tests
- Production Vite build verification

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
- Drag and resize may use transient visual state, but only the completed operation enters history.
- Project files remain portable and filesystem-oriented.
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

Verification runs:

1. TypeScript core build
2. Core and integration tests
3. Editor contract tests
4. Production web build

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

## Roadmap

### `v0.5.0` - Design System

- Design tokens
- Themes
- Breakpoints
- Responsive overrides
- Reusable components
- Component overrides

### Later milestones

- Runtime variables and interactions
- Preview runtime
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
