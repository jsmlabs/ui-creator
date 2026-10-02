import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CommandHistory,
  CreateNodeCommand,
  CreateReusableComponentCommand,
  DeleteBreakpointCommand,
  DeleteComponentDefinitionCommand,
  DeleteDesignTokenCommand,
  DeleteSubtreeCommand,
  DeleteThemeCommand,
  DeleteInteractionCommand,
  DeleteRuntimeVariableCommand,
  DuplicateSubtreeCommand,
  MoveNodeCommand,
  SetActiveThemeCommand,
  UpdateBreakpointCommand,
  UpdateNodeCommand,
  UpsertDesignTokenCommand,
  UpsertThemeCommand,
  UpsertInteractionCommand,
  UpsertRuntimeVariableCommand
} from "../../../packages/commands/src/index";
import type { Command } from "../../../packages/commands/src/types";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { Preview } from "./components/Preview";
import { Sidebar } from "./components/Sidebar";
import { createComponentInstance, createComponentNode, getDefaultParent } from "./editor";
import { useResizablePanel } from "./hooks/useResizablePanel";
import type { DesignToken, Interaction, LoadedProject, ProjectDocument, ProjectSummary, RuntimeVariable } from "./types";

const fallbackProject: ProjectDocument = {
  schemaVersion: 3,
  id: "demo-project",
  name: "Untitled Interface",
  metadata: { createdAt: "2026-10-02T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z" },
  settings: { activeThemeId: "theme-dark", breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 } },
  rootPageId: "page-home",
  pages: { "page-home": { id: "page-home", name: "Home", path: "/", rootNodeId: "node-root", metadata: {} } },
  nodes: {
    "node-root": {
      id: "node-root", type: "container", name: "Home Root", parentId: null, children: [], props: { direction: "column" },
      style: { display: "flex", padding: { kind: "token", tokenId: "spacing.md" }, gap: { kind: "token", tokenId: "spacing.sm" }, background: { kind: "token", tokenId: "color.surface.canvas" }, color: { kind: "token", tokenId: "color.text.primary" } },
      responsive: {}, states: {}, visible: true, locked: false
    }
  },
  components: {},
  tokens: {
    "color.surface.canvas": { id: "color.surface.canvas", category: "color", value: "#101014" },
    "color.surface.control": { id: "color.surface.control", category: "color", value: "#17171b" },
    "color.text.primary": { id: "color.text.primary", category: "color", value: "#e4e4e7" },
    "color.accent.primary": { id: "color.accent.primary", category: "color", value: "#7c8cff" },
    "spacing.sm": { id: "spacing.sm", category: "spacing", value: "8px" },
    "spacing.md": { id: "spacing.md", category: "spacing", value: "16px" },
    "radius.md": { id: "radius.md", category: "radius", value: "6px" }
  },
  themes: {
    "theme-dark": { id: "theme-dark", name: "Dark", tokenOverrides: {} },
    "theme-light": { id: "theme-light", name: "Light", tokenOverrides: { "color.surface.canvas": "#ffffff", "color.surface.control": "#f4f4f5", "color.text.primary": "#18181b", "color.accent.primary": "#5967d8" } }
  },
  variables: {}, interactions: {}, assets: {}
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as { ok: boolean; data: T };
  if (!payload.ok) throw new Error("API request failed.");
  return payload.data;
}

export function App() {
  const leftPanel = useResizablePanel({ initial: 280, min: 220, max: 460, direction: "left" });
  const rightPanel = useResizablePanel({ initial: 320, min: 260, max: 500, direction: "right" });
  const historyRef = useRef(new CommandHistory());
  const [project, setProject] = useState<ProjectDocument>(fallbackProject);
  const [activePageId, setActivePageId] = useState<string | null>(fallbackProject.rootPageId);
  const [activeBreakpointId, setActiveBreakpointId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(fallbackProject.pages["page-home"]!.rootNodeId);
  const [connection, setConnection] = useState<"connected" | "offline">("offline");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const projects = await fetchJson<ProjectSummary[]>("/api/v1/projects");
        if (cancelled) return;
        setConnection("connected");
        if (projects.length === 0) return;
        const loaded = await fetchJson<LoadedProject>(`/api/v1/projects/${encodeURIComponent(projects[0]!.id)}`);
        if (cancelled) return;
        setProject(loaded.project);
        setActivePageId(loaded.project.rootPageId);
        const rootPage = loaded.project.rootPageId ? loaded.project.pages[loaded.project.rootPageId] : undefined;
        setSelectedNodeId(rootPage?.rootNodeId ?? null);
        historyRef.current.clear();
        setHistoryVersion(value => value + 1);
      } catch {
        if (!cancelled) setConnection("offline");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const selectedNode = useMemo(() => selectedNodeId ? project.nodes[selectedNodeId] ?? null : null, [project.nodes, selectedNodeId]);
  const history = historyRef.current;

  const execute = (command: Command, nextSelection?: string | null) => {
    try {
      const next = history.execute(project, command);
      setProject(next);
      setDirty(true);
      setMessage(command.type);
      if (nextSelection !== undefined) setSelectedNodeId(nextSelection);
      else if (selectedNodeId && !next.nodes[selectedNodeId]) setSelectedNodeId(null);
      setHistoryVersion(value => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Command failed");
    }
  };

  const undo = () => {
    const next = history.undo(project);
    if (next !== project) {
      setProject(next); setDirty(true);
      if (selectedNodeId && !next.nodes[selectedNodeId]) setSelectedNodeId(null);
      setMessage("Undo"); setHistoryVersion(value => value + 1);
    }
  };

  const redo = () => {
    const next = history.redo(project);
    if (next !== project) { setProject(next); setDirty(true); setMessage("Redo"); setHistoryVersion(value => value + 1); }
  };

  const save = async () => {
    if (connection !== "connected") return setMessage("Offline preview cannot save");
    try {
      const saved = await fetchJson<ProjectDocument>(`/api/v1/projects/${encodeURIComponent(project.id)}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(project)
      });
      setProject(saved); setDirty(false); setMessage("Saved");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed"); }
  };

  const selectPage = (pageId: string) => { setActivePageId(pageId); setSelectedNodeId(project.pages[pageId]?.rootNodeId ?? null); };

  const addComponent = (type: string) => {
    const parentId = getDefaultParent(project, selectedNodeId, activePageId);
    if (!parentId) return setMessage("No valid parent selected");
    const node = createComponentNode(type);
    execute(new CreateNodeCommand(node, parentId), node.id);
  };

  const insertReusableComponent = (componentId: string) => {
    const parentId = getDefaultParent(project, selectedNodeId, activePageId);
    if (!parentId) return setMessage("No valid parent selected");
    try {
      const node = createComponentInstance(project, componentId);
      execute(new CreateNodeCommand(node, parentId), node.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Component insert failed"); }
  };

  const createReusableComponent = () => {
    if (!selectedNode) return setMessage("Select a node first");
    execute(new CreateReusableComponentCommand(selectedNode.id, selectedNode.name));
  };

  const deleteSelected = () => {
    if (!selectedNode || selectedNode.parentId === null) return setMessage("Page root cannot be deleted");
    execute(new DeleteSubtreeCommand(selectedNode.id), selectedNode.parentId);
  };

  const duplicateSelected = () => {
    if (!selectedNode || selectedNode.parentId === null) return setMessage("Page root cannot be duplicated");
    execute(new DuplicateSubtreeCommand(selectedNode.id));
  };

  const resizeNode = (nodeId: string, width: number, height: number) => {
    const node = project.nodes[nodeId];
    if (!node) return;
    const size = { width: { kind: "literal" as const, value: `${Math.round(width)}px` }, height: { kind: "literal" as const, value: `${Math.round(height)}px` } };
    if (activeBreakpointId) {
      if (node.componentRef) {
        const overrides = node.componentOverrides ?? { props: {}, style: {}, responsive: {} };
        execute(new UpdateNodeCommand(nodeId, { componentOverrides: { ...overrides, responsive: { ...(overrides.responsive ?? {}), [activeBreakpointId]: { ...(overrides.responsive?.[activeBreakpointId] ?? {}), ...size } } } }));
      } else execute(new UpdateNodeCommand(nodeId, { responsive: { ...node.responsive, [activeBreakpointId]: { ...(node.responsive[activeBreakpointId] ?? {}), ...size } } }));
    } else if (node.componentRef) {
      const overrides = node.componentOverrides ?? { props: {}, style: {}, responsive: {} };
      execute(new UpdateNodeCommand(nodeId, { componentOverrides: { ...overrides, style: { ...(overrides.style ?? {}), ...size } } }));
    } else execute(new UpdateNodeCommand(nodeId, { style: { ...node.style, ...size } }));
  };


  const upsertVariable = (variable: RuntimeVariable) => execute(new UpsertRuntimeVariableCommand(variable));
  const deleteVariable = (variableId: string) => execute(new DeleteRuntimeVariableCommand(variableId));
  const upsertInteraction = (interaction: Interaction) => execute(new UpsertInteractionCommand(interaction));
  const deleteInteraction = (interactionId: string) => execute(new DeleteInteractionCommand(interactionId));

  const upsertToken = (token: DesignToken) => execute(new UpsertDesignTokenCommand(token));
  const updateThemeToken = (themeId: string, tokenId: string, value: string) => {
    const theme = project.themes[themeId];
    if (!theme) return;
    execute(new UpsertThemeCommand({ ...theme, tokenOverrides: { ...theme.tokenOverrides, [tokenId]: value } }));
  };

  const clearThemeToken = (themeId: string, tokenId: string) => {
    const theme = project.themes[themeId];
    if (!theme) return;
    const tokenOverrides = { ...theme.tokenOverrides };
    delete tokenOverrides[tokenId];
    execute(new UpsertThemeCommand({ ...theme, tokenOverrides }));
  };

  const createTheme = (id: string, name: string) => {
    execute(new UpsertThemeCommand({ id, name, tokenOverrides: {} }));
  };

  const deleteTheme = (themeId: string) => execute(new DeleteThemeCommand(themeId));
  const deleteBreakpoint = (breakpointId: string) => execute(new DeleteBreakpointCommand(breakpointId));
  const deleteReusableComponent = (componentId: string) => execute(new DeleteComponentDefinitionCommand(componentId));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (editing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelected(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  void historyVersion;

  if (previewOpen) return <Preview project={project} onClose={() => setPreviewOpen(false)}/>;

  return (
    <div className="app-shell" style={{ "--left-panel": `${leftPanel.size}px`, "--right-panel": `${rightPanel.size}px` } as CSSProperties}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark">UI</div><strong>Creator</strong><span className="version">v0.6.0</span></div>
        <div className="project-crumbs"><button type="button">{project.name}{dirty ? " *" : ""}</button><span>/</span><button type="button">{activePageId ? project.pages[activePageId]?.name : "No page"}</button><span>/</span><span className="theme-label">{project.settings.activeThemeId ? project.themes[project.settings.activeThemeId]?.name : "No theme"}</span></div>
        <div className="topbar-actions">
          <button className="top-button" type="button" onClick={undo} disabled={!history.canUndo}>Undo</button>
          <button className="top-button" type="button" onClick={redo} disabled={!history.canRedo}>Redo</button>
          <span className={`connection ${connection}`}>{connection === "connected" ? "Local server" : "Offline preview"}</span>
          <button className="top-button" type="button" onClick={() => setPreviewOpen(true)}>Preview</button><button className="top-button" type="button">Export</button>
          <button className="top-button primary" type="button" onClick={() => void save()} disabled={!dirty}>Save</button>
        </div>
      </header>

      <div className="workspace">
        <div className="left-panel" style={{ width: leftPanel.size }}>
          <Sidebar
            project={project}
            activePageId={activePageId}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onSelectPage={selectPage}
            onAddComponent={addComponent}
            onInsertReusableComponent={insertReusableComponent}
            onCreateReusableComponent={createReusableComponent}
            onDeleteReusableComponent={deleteReusableComponent}
            onMoveNode={(nodeId, parentId, index) => execute(new MoveNodeCommand(nodeId, parentId, index), nodeId)}
            onUpsertToken={upsertToken}
            onDeleteToken={tokenId => execute(new DeleteDesignTokenCommand(tokenId))}
            onSetTheme={themeId => execute(new SetActiveThemeCommand(themeId || null))}
            onCreateTheme={createTheme}
            onDeleteTheme={deleteTheme}
            onUpdateThemeToken={updateThemeToken}
            onClearThemeToken={clearThemeToken}
            onUpdateBreakpoint={(id, value) => execute(new UpdateBreakpointCommand(id, value))}
            onDeleteBreakpoint={deleteBreakpoint}
            onUpsertVariable={upsertVariable}
            onDeleteVariable={deleteVariable}
          />
        </div>
        <div className="resize-handle vertical" role="separator" aria-orientation="vertical" onPointerDown={leftPanel.beginResize}/>
        <Canvas project={project} activePageId={activePageId} activeBreakpointId={activeBreakpointId} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} onMoveNode={(nodeId, parentId, index) => execute(new MoveNodeCommand(nodeId, parentId, index), nodeId)} onResizeNode={resizeNode} onBreakpointChange={setActiveBreakpointId}/>
        <div className="resize-handle vertical" role="separator" aria-orientation="vertical" onPointerDown={rightPanel.beginResize}/>
        <div className="right-panel" style={{ width: rightPanel.size }}>
          <Inspector project={project} node={selectedNode} activeBreakpointId={activeBreakpointId} onUpdate={changes => selectedNode && execute(new UpdateNodeCommand(selectedNode.id, changes))} onDelete={deleteSelected} onDuplicate={duplicateSelected} onCreateReusable={createReusableComponent} onUpsertInteraction={upsertInteraction} onDeleteInteraction={deleteInteraction}/>
        </div>
      </div>

      <footer className="statusbar"><span>{message}</span><span>DOM Canvas</span><span>Schema v3</span><span>{activeBreakpointId ?? "Base"}</span><span className="statusbar-spacer"/><span>{Object.keys(project.variables).length} vars</span><span>{Object.keys(project.interactions).length} interactions</span><span>{Object.keys(project.tokens).length} tokens</span><span>{Object.keys(project.components).length} components</span><span>{Object.keys(project.nodes).length} nodes</span></footer>
    </div>
  );
}
