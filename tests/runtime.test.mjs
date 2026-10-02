import assert from "node:assert/strict";
import test from "node:test";

import { CommandHistory, CreateNodeCommand, DeleteInteractionCommand, DeleteRuntimeVariableCommand, UpsertInteractionCommand, UpsertRuntimeVariableCommand } from "../dist/packages/commands/src/index.js";
import { createNode, createProject, migrateProject } from "../dist/packages/schema/src/index.js";
import { createRuntimeState, executeInteraction, interactionsFor, isNodeRuntimeVisible } from "../dist/packages/runtime/src/index.js";
import { validateProject } from "../dist/packages/validation/src/index.js";

const fixedNow = new Date("2026-10-02T00:00:00.000Z");

test("runtime state is initialized from project variables without mutating design state", () => {
  const project = createProject("Runtime", fixedNow);
  project.variables.count = { id: "count", name: "Count", type: "number", initialValue: 2 };
  const before = structuredClone(project);
  const state = createRuntimeState(project);
  state.variables.count = 7;
  assert.equal(project.variables.count.initialValue, 2);
  assert.deepEqual(project, before);
});

test("runtime actions navigate, toggle visibility and update variables deterministically", () => {
  const project = createProject("Actions", fixedNow);
  const root = project.pages[project.rootPageId].rootNodeId;
  const modal = createNode({ id: "modal", type: "modal", name: "Modal", visible: false });
  project.nodes[modal.id] = { ...modal, parentId: root };
  project.nodes[root].children.push(modal.id);
  project.variables.openCount = { id: "openCount", name: "Open count", type: "number", initialValue: 0 };
  const interaction = {
    id: "interaction-open",
    sourceNodeId: root,
    event: "click",
    actions: [
      { type: "toggle", payload: { targetNodeId: modal.id } },
      { type: "updateVariable", payload: { variableId: "openCount", operation: "increment", amount: 1 } }
    ]
  };
  project.interactions[interaction.id] = interaction;
  assert.equal(validateProject(project).valid, true);
  const initial = createRuntimeState(project);
  const next = executeInteraction(project, initial, interaction);
  assert.equal(isNodeRuntimeVisible(project, initial, modal.id), false);
  assert.equal(isNodeRuntimeVisible(project, next, modal.id), true);
  assert.equal(next.variables.openCount, 1);
  assert.equal(initial.variables.openCount, 0);
});

test("runtime variable and interaction commands are reversible and protected by references", () => {
  const history = new CommandHistory();
  let project = createProject("Runtime commands", fixedNow);
  const root = project.pages[project.rootPageId].rootNodeId;
  project = history.execute(project, new UpsertRuntimeVariableCommand({ id: "flag", name: "Flag", type: "boolean", initialValue: false }));
  project = history.execute(project, new UpsertInteractionCommand({ id: "interaction-flag", sourceNodeId: root, event: "click", actions: [{ type: "updateVariable", payload: { variableId: "flag", operation: "toggle" } }] }));
  assert.equal(interactionsFor(project, root, "click").length, 1);
  assert.throws(() => new DeleteRuntimeVariableCommand("flag").execute(project));
  project = history.execute(project, new DeleteInteractionCommand("interaction-flag"));
  project = history.execute(project, new DeleteRuntimeVariableCommand("flag"));
  assert.equal(project.variables.flag, undefined);
  project = history.undo(project);
  assert.equal(project.variables.flag.initialValue, false);
});

test("validation rejects broken runtime references", () => {
  const project = createProject("Runtime invalid", fixedNow);
  const root = project.pages[project.rootPageId].rootNodeId;
  project.interactions.bad = { id: "bad", sourceNodeId: root, event: "click", actions: [{ type: "navigate", payload: { pageId: "missing" } }, { type: "setVariable", payload: { variableId: "missing", value: "x" } }] };
  const result = validateProject(project);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(issue => issue.code === "NAVIGATION_PAGE_NOT_FOUND"));
  assert.ok(result.issues.some(issue => issue.code === "RUNTIME_VARIABLE_NOT_FOUND"));
});

test("schema v2 runtime variables migrate to schema v3", () => {
  const current = createProject("Migration", fixedNow);
  const legacy = structuredClone(current);
  legacy.schemaVersion = 2;
  legacy.variables = { legacy: { id: "legacy", name: "Legacy", value: true } };
  const migrated = migrateProject(legacy);
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.variables.legacy, { id: "legacy", name: "Legacy", type: "boolean", initialValue: true });
  assert.equal(validateProject(migrated).valid, true);
});
