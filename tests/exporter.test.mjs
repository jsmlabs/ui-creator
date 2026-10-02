import assert from "node:assert/strict";
import test from "node:test";
import { createProject, createNode } from "../dist/packages/schema/src/index.js";
import { exportProject } from "../dist/packages/exporter/src/index.js";

test("production export is deterministic and includes the expected React TypeScript Tailwind surface", () => {
  const project = createProject("Acme Dashboard", new Date("2026-10-02T00:00:00.000Z"));
  const first = exportProject(project);
  const second = exportProject(structuredClone(project));
  assert.deepEqual(first, second);
  assert.equal(first.fileName, "acme-dashboard-export.zip");
  assert.ok(first.files["src/App.tsx"]?.includes("createRuntimeState"));
  assert.ok(first.files["src/styles.css"]?.includes('@import "tailwindcss"'));
  assert.ok(first.files["vite.config.ts"]?.includes("tailwindcss()"));
  assert.ok(first.files["package.json"]?.includes('"react": "19.3.0"'));
  assert.ok(first.files["src/project.ts"]?.includes(project.id));
});

test("export preserves project structure and declarative interactions without eval", () => {
  const project = createProject("Runtime Export", new Date("2026-10-02T00:00:00.000Z"));
  const page = project.pages[project.rootPageId];
  const button = createNode({ id: "node-button", type: "button", name: "Continue", parentId: page.rootNodeId, props: { text: "Continue" } });
  project.nodes[button.id] = button;
  project.nodes[page.rootNodeId].children.push(button.id);
  project.variables.count = { id: "count", name: "Count", type: "number", initialValue: 0 };
  project.interactions.advance = { id: "advance", sourceNodeId: button.id, event: "click", actions: [{ type: "updateVariable", payload: { variableId: "count", operation: "increment" } }] };
  const bundle = exportProject(project);
  const all = Object.values(bundle.files).join("\n");
  assert.match(bundle.files["src/project.ts"], /\"advance\"/);
  assert.match(bundle.files["src/project.ts"], /\"count\"/);
  assert.doesNotMatch(all, /\beval\s*\(/);
  assert.doesNotMatch(all, /new Function\s*\(/);
});
