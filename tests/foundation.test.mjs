import assert from "node:assert/strict";
import test from "node:test";
import { CommandHistory, CreateNodeCommand, MoveNodeCommand, UpdateNodeCommand } from "../dist/packages/commands/src/index.js";
import { createNode, createProject } from "../dist/packages/schema/src/index.js";
import { deserializeProject, serializeProject } from "../dist/packages/serialization/src/index.js";
import { stableStringify } from "../dist/packages/shared/src/index.js";
import { validateProject } from "../dist/packages/validation/src/index.js";

const fixedNow = new Date("2026-10-02T00:00:00.000Z");

test("project factory creates a valid project", () => {
  const project = createProject("Test Project", fixedNow);
  const result = validateProject(project);
  assert.equal(result.valid, true);
  assert.equal(project.metadata.createdAt, fixedNow.toISOString());
  assert.ok(project.rootPageId);
});

test("serialization is deterministic regardless of object insertion order", () => {
  const a = { z: 1, a: { y: 2, b: 3 } };
  const b = { a: { b: 3, y: 2 }, z: 1 };
  assert.equal(stableStringify(a), stableStringify(b));
});

test("project round-trip preserves exact serialized representation", () => {
  const project = createProject("Round Trip", fixedNow);
  const serialized = serializeProject(project);
  const loaded = deserializeProject(serialized);
  assert.equal(serializeProject(loaded), serialized);
});

test("create, update, undo and redo restore exact project states", () => {
  const history = new CommandHistory();
  let project = createProject("History", fixedNow);
  const original = serializeProject(project);
  const rootPage = project.pages[project.rootPageId];
  const child = createNode({ id: "node_child", type: "text", name: "Label" });
  project = history.execute(project, new CreateNodeCommand(child, rootPage.rootNodeId));
  const afterCreate = serializeProject(project);
  project = history.execute(project, new UpdateNodeCommand(child.id, { name: "Updated Label", visible: false }));
  assert.equal(project.nodes[child.id].name, "Updated Label");
  assert.equal(project.nodes[child.id].visible, false);
  project = history.undo(project);
  assert.equal(serializeProject(project), afterCreate);
  project = history.undo(project);
  assert.equal(serializeProject(project), original);
  project = history.redo(project);
  assert.equal(serializeProject(project), afterCreate);
  project = history.redo(project);
  assert.equal(project.nodes[child.id].name, "Updated Label");
  assert.equal(project.nodes[child.id].visible, false);
});

test("move command rejects cycles", () => {
  const history = new CommandHistory();
  let project = createProject("Cycle", fixedNow);
  const root = project.pages[project.rootPageId].rootNodeId;
  const parent = createNode({ id: "parent", type: "stack", name: "Parent" });
  const child = createNode({ id: "child", type: "text", name: "Child" });
  project = history.execute(project, new CreateNodeCommand(parent, root));
  project = history.execute(project, new CreateNodeCommand(child, parent.id));
  assert.throws(() => history.execute(project, new MoveNodeCommand(parent.id, child.id)), /Cannot move a node into itself or its descendant/);
});

test("validation detects broken parent references", () => {
  const project = createProject("Broken", fixedNow);
  const root = project.pages[project.rootPageId].rootNodeId;
  project.nodes[root].parentId = "missing";
  const result = validateProject(project);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(issue => issue.code === "BROKEN_PARENT_REFERENCE"));
});

test("subtree delete undo restores all descendants exactly", async () => {
  const { DeleteSubtreeCommand } = await import("../dist/packages/commands/src/index.js");
  const history = new CommandHistory();
  let project = createProject("Subtree", fixedNow);
  const root = project.pages[project.rootPageId].rootNodeId;
  const parent = createNode({ id: "sub_parent", type: "stack", name: "Parent" });
  const child = createNode({ id: "sub_child", type: "text", name: "Child" });
  project = history.execute(project, new CreateNodeCommand(parent, root));
  project = history.execute(project, new CreateNodeCommand(child, parent.id));
  const beforeDelete = serializeProject(project);
  project = history.execute(project, new DeleteSubtreeCommand(parent.id));
  assert.equal(project.nodes[parent.id], undefined);
  assert.equal(project.nodes[child.id], undefined);
  project = history.undo(project);
  assert.equal(serializeProject(project), beforeDelete);
});

test("duplicate subtree redo restores the exact same generated ids", async () => {
  const { DuplicateSubtreeCommand } = await import("../dist/packages/commands/src/index.js");
  const history = new CommandHistory();
  let project = createProject("Duplicate", fixedNow);
  const root = project.pages[project.rootPageId].rootNodeId;
  const parent = createNode({ id: "dup_parent", type: "stack", name: "Parent" });
  const child = createNode({ id: "dup_child", type: "text", name: "Child" });
  project = history.execute(project, new CreateNodeCommand(parent, root));
  project = history.execute(project, new CreateNodeCommand(child, parent.id));
  project = history.execute(project, new DuplicateSubtreeCommand(parent.id));
  const duplicated = serializeProject(project);
  project = history.undo(project);
  project = history.redo(project);
  assert.equal(serializeProject(project), duplicated);
});
