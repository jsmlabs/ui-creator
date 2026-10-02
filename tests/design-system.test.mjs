import assert from "node:assert/strict";
import test from "node:test";

import {
  CommandHistory,
  CreateNodeCommand,
  CreateReusableComponentCommand,
  DeleteDesignTokenCommand,
  SetActiveThemeCommand,
  UpdateBreakpointCommand,
  UpdateNodeCommand,
  UpsertDesignTokenCommand,
  UpsertThemeCommand
} from "../dist/packages/commands/src/index.js";
import { createNode, createProject, migrateProject } from "../dist/packages/schema/src/index.js";
import { serializeProject } from "../dist/packages/serialization/src/index.js";
import { validateProject } from "../dist/packages/validation/src/index.js";

const fixedNow = new Date("2026-10-02T00:00:00.000Z");

test("project factory seeds a valid default design system", () => {
  const project = createProject("Design System", fixedNow);
  assert.equal(project.settings.activeThemeId, "theme-dark");
  assert.ok(project.tokens["color.text.primary"]);
  assert.ok(project.themes["theme-light"]);
  assert.equal(validateProject(project).valid, true);
});

test("design token and theme commands are reversible", () => {
  const history = new CommandHistory();
  let project = createProject("Tokens", fixedNow);
  project = history.execute(project, new UpsertDesignTokenCommand({ id: "color.brand.primary", category: "color", value: "#123456" }));
  assert.equal(project.tokens["color.brand.primary"].value, "#123456");
  project = history.execute(project, new UpsertThemeCommand({ id: "theme-brand", name: "Brand", tokenOverrides: { "color.brand.primary": "#654321" } }));
  project = history.execute(project, new SetActiveThemeCommand("theme-brand"));
  assert.equal(project.settings.activeThemeId, "theme-brand");
  project = history.undo(project);
  assert.equal(project.settings.activeThemeId, "theme-dark");
  project = history.redo(project);
  assert.equal(project.settings.activeThemeId, "theme-brand");
});

test("breakpoint commands preserve responsive validity", () => {
  const history = new CommandHistory();
  let project = createProject("Responsive", fixedNow);
  project = history.execute(project, new UpdateBreakpointCommand("tablet", 900));
  assert.equal(project.settings.breakpoints.tablet, 900);
  assert.equal(validateProject(project).valid, true);
  project = history.undo(project);
  assert.equal(project.settings.breakpoints.tablet, undefined);
});

test("reusable component definitions clone source subtrees and survive undo redo", () => {
  const history = new CommandHistory();
  let project = createProject("Components", fixedNow);
  const root = project.pages[project.rootPageId].rootNodeId;
  const stack = createNode({ id: "node_stack", type: "stack", name: "Card", style: { display: "flex" }, props: { direction: "column" } });
  const text = createNode({ id: "node_text", type: "text", name: "Title", props: { text: "Hello" } });
  project = history.execute(project, new CreateNodeCommand(stack, root));
  project = history.execute(project, new CreateNodeCommand(text, stack.id));
  project = history.execute(project, new CreateReusableComponentCommand(stack.id, "Card"));
  const definitions = Object.values(project.components);
  assert.equal(definitions.length, 1);
  const definition = definitions[0];
  assert.equal(definition.name, "Card");
  const definitionRoot = project.nodes[definition.rootNodeId];
  assert.equal(definitionRoot.parentId, null);
  assert.equal(definitionRoot.children.length, 1);
  assert.notEqual(definitionRoot.id, stack.id);
  const componentId = definition.id;
  project = history.undo(project);
  assert.equal(project.components[componentId], undefined);
  project = history.redo(project);
  assert.ok(project.components[componentId]);
  assert.equal(validateProject(project).valid, true);
});

test("validation rejects missing responsive breakpoints and theme token references", () => {
  const project = createProject("Invalid Design", fixedNow);
  const root = project.pages[project.rootPageId].rootNodeId;
  project.nodes[root].responsive.missing = { width: { kind: "literal", value: "100px" } };
  project.themes["theme-dark"].tokenOverrides["missing.token"] = "x";
  const result = validateProject(project);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(issue => issue.code === "BREAKPOINT_NOT_FOUND"));
  assert.ok(result.issues.some(issue => issue.code === "THEME_TOKEN_NOT_FOUND"));
});


test("schema v1 projects migrate to schema v3 without losing existing design data", () => {
  const current = createProject("Migration", fixedNow);
  const legacy = structuredClone(current);
  legacy.schemaVersion = 1;
  legacy.tokens = { "custom.spacing": { id: "custom.spacing", category: "spacing", value: "20px" } };
  legacy.themes = {};
  legacy.settings.activeThemeId = null;
  delete legacy.settings.breakpoints["2xl"];

  const migrated = migrateProject(legacy);
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.tokens["custom.spacing"].value, "20px");
  assert.ok(migrated.tokens["spacing.md"]);
  assert.ok(migrated.themes["theme-dark"]);
  assert.equal(migrated.settings.activeThemeId, null);
  assert.equal(migrated.settings.breakpoints["2xl"], 1536);
  assert.equal(validateProject(migrated).valid, true);
});

test("deleting a token restores theme overrides exactly on undo", () => {
  const history = new CommandHistory();
  let project = createProject("Token Undo", fixedNow);
  project = history.execute(project, new UpsertDesignTokenCommand({ id: "color.temp", category: "color", value: "#111111" }));
  project = history.execute(project, new UpsertThemeCommand({ ...project.themes["theme-light"], tokenOverrides: { ...project.themes["theme-light"].tokenOverrides, "color.temp": "#eeeeee" } }));
  const beforeDelete = serializeProject(project);
  project = history.execute(project, new DeleteDesignTokenCommand("color.temp"));
  assert.equal(project.tokens["color.temp"], undefined);
  project = history.undo(project);
  assert.equal(serializeProject(project), beforeDelete);
});

test("component instance overrides remain local and reversible", () => {
  const history = new CommandHistory();
  let project = createProject("Overrides", fixedNow);
  const root = project.pages[project.rootPageId].rootNodeId;
  const source = createNode({ id: "source_button", type: "button", name: "Primary Button", props: { text: "Base" } });
  project = history.execute(project, new CreateNodeCommand(source, root));
  project = history.execute(project, new CreateReusableComponentCommand(source.id, "Button"));
  const component = Object.values(project.components)[0];
  const instance = createNode({ id: "button_instance", type: "component-instance", name: "Button Instance", componentRef: component.id, componentOverrides: { props: { text: "Override" }, style: {}, responsive: {} } });
  project = history.execute(project, new CreateNodeCommand(instance, root));
  const before = serializeProject(project);
  project = history.execute(project, new UpdateNodeCommand(instance.id, { componentOverrides: { props: { text: "Changed" }, style: {}, responsive: {} } }));
  assert.equal(project.nodes[instance.id].componentOverrides.props.text, "Changed");
  assert.equal(project.nodes[component.rootNodeId].props.text, "Base");
  project = history.undo(project);
  assert.equal(serializeProject(project), before);
});
