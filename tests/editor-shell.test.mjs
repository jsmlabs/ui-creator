import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appPath = new URL("../apps/web/src/App.tsx", import.meta.url);
const sidebarPath = new URL("../apps/web/src/components/Sidebar.tsx", import.meta.url);
const canvasPath = new URL("../apps/web/src/components/Canvas.tsx", import.meta.url);
const inspectorPath = new URL("../apps/web/src/components/Inspector.tsx", import.meta.url);
const vitePath = new URL("../apps/web/vite.config.ts", import.meta.url);
const editorPath = new URL("../apps/web/src/editor.ts", import.meta.url);
const previewPath = new URL("../apps/web/src/components/Preview.tsx", import.meta.url);

test("editor shell source preserves local architecture while enabling Milestone 5 runtime editing", async () => {
  const [app, sidebar, canvas, inspector, vite, preview] = await Promise.all([
    readFile(appPath, "utf8"), readFile(sidebarPath, "utf8"), readFile(canvasPath, "utf8"), readFile(inspectorPath, "utf8"), readFile(vitePath, "utf8"), readFile(previewPath, "utf8")
  ]);

  assert.match(app, /<Sidebar/);
  assert.match(app, /<Canvas/);
  assert.match(app, /<Inspector/);
  assert.match(app, /CommandHistory/);
  assert.match(app, /CreateNodeCommand/);
  assert.match(app, /UpdateNodeCommand/);
  assert.match(app, /MoveNodeCommand/);
  assert.match(app, /DuplicateSubtreeCommand/);
  assert.match(app, /DeleteSubtreeCommand/);
  assert.match(app, /method:\s*"PUT"/);

  assert.match(sidebar, /draggable/);
  assert.match(sidebar, /onMoveNode/);
  assert.match(sidebar, /componentTemplates/);
  assert.match(canvas, /node-resize-handle/);
  assert.match(canvas, /onDrop/);
  assert.match(inspector, /Design System|Responsive scope/);
  assert.match(inspector, /Flex/);
  assert.match(inspector, /Grid/);
  assert.match(inspector, /Padding/);
  assert.match(inspector, /Typography/);
  assert.match(inspector, /Font size/);
  assert.match(inspector, /Background/);
  assert.match(inspector, /token-select/);
  assert.match(inspector, /Component instance override/);
  assert.match(sidebar, /Design/);
  assert.match(sidebar, /Tokens/);
  assert.match(sidebar, /Breakpoints/);
  assert.match(sidebar, /Reusable/);
  assert.match(canvas, /Responsive breakpoint/);
  assert.match(app, /CreateReusableComponentCommand/);
  assert.match(app, /UpsertDesignTokenCommand/);
  assert.match(app, /SetActiveThemeCommand/);
  assert.match(app, /DeleteThemeCommand/);
  assert.match(app, /DeleteBreakpointCommand/);
  assert.match(app, /DeleteComponentDefinitionCommand/);
  assert.match(app, /Schema v3/);
  assert.match(app, /UpsertRuntimeVariableCommand/);
  assert.match(app, /UpsertInteractionCommand/);
  assert.match(app, /<Preview/);
  assert.match(sidebar, /Runtime/);
  assert.match(sidebar, /Variables/);
  assert.match(inspector, /Runtime interactions/);
  assert.match(preview, /Interactive Preview/);
  assert.match(preview, /createRuntimeState/);
  assert.match(preview, /executeInteraction/);
  assert.match(sidebar, /New theme name/);
  assert.match(sidebar, /token-create-expanded/);
  assert.match(sidebar, /onDeleteBreakpoint/);
  assert.match(vite, /127\.0\.0\.1/);
  assert.match(vite, /4173/);
  assert.match(vite, /4174/);
});

test("root npm workspace installs and addresses the web application", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(packageJson.workspaces, ["apps/web"]);
  assert.equal(packageJson.scripts["build:web"], "npm run build --workspace @ui-creator/web");
  assert.equal(packageJson.scripts["dev:web"], "npm run dev --workspace @ui-creator/web");
  assert.equal(packageJson.scripts.dev, "node scripts/dev.mjs");
});


test("web style resolver narrows CSS color literals to strings", async () => {
  const editor = await readFile(editorPath, "utf8");
  assert.match(editor, /const color = get\(style\.color\);/);
  assert.match(editor, /css\.color = typeof color === "string" \? color : undefined;/);
  assert.doesNotMatch(editor, /css\.color = get\(style\.color\);/);
});

test("dev launcher uses cmd.exe for npm scripts on Windows", async () => {
  const source = await readFile(new URL("../scripts/dev.mjs", import.meta.url), "utf8");
  assert.match(source, /process\.platform === "win32"/);
  assert.match(source, /process\.env\.ComSpec \|\| "cmd\.exe"/);
  assert.match(source, /\["\/d", "\/s", "\/c", `npm run \$\{script\}`\]/);
  assert.doesNotMatch(source, /"npm\.cmd"/);
});
