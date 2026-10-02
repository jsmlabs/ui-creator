import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CommandHistory, CreateNodeCommand, DeleteSubtreeCommand, DuplicateSubtreeCommand, MoveNodeCommand, UpdateNodeCommand } from "../../../packages/commands/src/index";
import type { Command } from "../../../packages/commands/src/types";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import { createComponentNode, getDefaultParent } from "./editor";
import { useResizablePanel } from "./hooks/useResizablePanel";
import type { LoadedProject, ProjectDocument, ProjectSummary } from "./types";

const fallbackProject: ProjectDocument = {
  schemaVersion: 1,
  id: "demo-project",
  name: "Untitled Interface",
  metadata: { createdAt: "2026-10-02T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z" },
  settings: { activeThemeId: null, breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 } },
  rootPageId: "page-home",
  pages: {
    "page-home": { id: "page-home", name: "Home", path: "/", rootNodeId: "node-root", metadata: {} }
  },
  nodes: {
    "node-root": { id: "node-root", type: "container", name: "Home Root", parentId: null, children: [], props: {}, style: { display: "flex", padding: { kind: "literal", value: "24px" }, gap: { kind: "literal", value: "12px" } }, responsive: {}, states: {}, visible: true, locked: false }
  },
  components: {}, tokens: {}, themes: {}, variables: {}, interactions: {}, assets: {}
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
  const leftPanel = useResizablePanel({ initial: 260, min: 200, max: 420, direction: "left" });
  const rightPanel = useResizablePanel({ initial: 300, min: 240, max: 460, direction: "right" });
  const historyRef = useRef(new CommandHistory());
  const [project, setProject] = useState<ProjectDocument>(fallbackProject);
  const [activePageId, setActivePageId] = useState<string | null>(fallbackProject.rootPageId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(fallbackProject.pages["page-home"].rootNodeId);
  const [connection, setConnection] = useState<"connected" | "offline">("offline");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const projects = await fetchJson<ProjectSummary[]>("/api/v1/projects");
        if (cancelled) return;
        setConnection("connected");
        if (projects.length === 0) return;
        const loaded = await fetchJson<LoadedProject>(`/api/v1/projects/${encodeURIComponent(projects[0].id)}`);
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
      setProject(next);
      setDirty(true);
      if (selectedNodeId && !next.nodes[selectedNodeId]) setSelectedNodeId(null);
      setMessage("Undo");
      setHistoryVersion(value => value + 1);
    }
  };

  const redo = () => {
    const next = history.redo(project);
    if (next !== project) {
      setProject(next);
      setDirty(true);
      setMessage("Redo");
      setHistoryVersion(value => value + 1);
    }
  };

  const save = async () => {
    if (connection !== "connected") {
      setMessage("Offline preview cannot save");
      return;
    }
    try {
      const saved = await fetchJson<ProjectDocument>(`/api/v1/projects/${encodeURIComponent(project.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(project)
      });
      setProject(saved);
      setDirty(false);
      setMessage("Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  };

  const selectPage = (pageId: string) => {
    setActivePageId(pageId);
    setSelectedNodeId(project.pages[pageId]?.rootNodeId ?? null);
  };

  const addComponent = (type: string) => {
    const parentId = getDefaultParent(project, selectedNodeId, activePageId);
    if (!parentId) return setMessage("No valid parent selected");
    const node = createComponentNode(type);
    execute(new CreateNodeCommand(node, parentId), node.id);
  };

  const deleteSelected = () => {
    if (!selectedNode || selectedNode.parentId === null) return setMessage("Page root cannot be deleted");
    const parentId = selectedNode.parentId;
    execute(new DeleteSubtreeCommand(selectedNode.id), parentId);
  };

  const duplicateSelected = () => {
    if (!selectedNode || selectedNode.parentId === null) return setMessage("Page root cannot be duplicated");
    execute(new DuplicateSubtreeCommand(selectedNode.id));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (editing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  void historyVersion;

  return (
    <div className="app-shell" style={{ "--left-panel": `${leftPanel.size}px`, "--right-panel": `${rightPanel.size}px` } as CSSProperties}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark">UI</div><strong>Creator</strong><span className="version">v0.4.3</span></div>
        <div className="project-crumbs"><button type="button">{project.name}{dirty ? " *" : ""}</button><span>/</span><button type="button">{activePageId ? project.pages[activePageId]?.name : "No page"}</button></div>
        <div className="topbar-actions">
          <button className="top-button" type="button" onClick={undo} disabled={!history.canUndo}>Undo</button>
          <button className="top-button" type="button" onClick={redo} disabled={!history.canRedo}>Redo</button>
          <span className={`connection ${connection}`}>{connection === "connected" ? "Local server" : "Offline preview"}</span>
          <button className="top-button" type="button">Preview</button>
          <button className="top-button" type="button">Export</button>
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
            onMoveNode={(nodeId, parentId, index) => execute(new MoveNodeCommand(nodeId, parentId, index), nodeId)}
          />
        </div>
        <div className="resize-handle vertical" role="separator" aria-orientation="vertical" onPointerDown={leftPanel.beginResize} />
        <Canvas
          project={project}
          activePageId={activePageId}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onMoveNode={(nodeId, parentId, index) => execute(new MoveNodeCommand(nodeId, parentId, index), nodeId)}
          onResizeNode={(nodeId, width, height) => {
            const node = project.nodes[nodeId];
            if (!node) return;
            execute(new UpdateNodeCommand(nodeId, { style: { ...node.style, width: { kind: "literal", value: `${Math.round(width)}px` }, height: { kind: "literal", value: `${Math.round(height)}px` } } }));
          }}
        />
        <div className="resize-handle vertical" role="separator" aria-orientation="vertical" onPointerDown={rightPanel.beginResize} />
        <div className="right-panel" style={{ width: rightPanel.size }}>
          <Inspector
            node={selectedNode}
            onUpdate={(changes) => selectedNode && execute(new UpdateNodeCommand(selectedNode.id, changes))}
            onDelete={deleteSelected}
            onDuplicate={duplicateSelected}
          />
        </div>
      </div>

      <footer className="statusbar">
        <span>{message}</span><span>DOM Canvas</span><span>Schema v1</span><span className="statusbar-spacer"/><span>{Object.keys(project.nodes).length} nodes</span><span>{Object.keys(project.pages).length} page</span>
      </footer>
    </div>
  );
}
