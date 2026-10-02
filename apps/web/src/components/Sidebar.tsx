import { useMemo, useState, type DragEvent } from "react";
import type { ProjectDocument } from "../types";
import { componentTemplates } from "../editor";
import { AssetsIcon, ComponentsIcon, EyeIcon, LayersIcon, LockIcon, PagesIcon } from "./Icons";

type Tab = "layers" | "pages" | "components" | "assets";

interface Props {
  project: ProjectDocument;
  activePageId: string | null;
  selectedNodeId: string | null;
  onSelectNode(nodeId: string): void;
  onSelectPage(pageId: string): void;
  onAddComponent(type: string): void;
  onMoveNode(nodeId: string, parentId: string, index?: number): void;
}

const tabs: Array<{ id: Tab; label: string; Icon: typeof LayersIcon }> = [
  { id: "layers", label: "Layers", Icon: LayersIcon },
  { id: "pages", label: "Pages", Icon: PagesIcon },
  { id: "components", label: "Components", Icon: ComponentsIcon },
  { id: "assets", label: "Assets", Icon: AssetsIcon }
];

export function Sidebar({ project, activePageId, selectedNodeId, onSelectNode, onSelectPage, onAddComponent, onMoveNode }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("layers");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const activePage = activePageId ? project.pages[activePageId] : undefined;

  const layerRows = useMemo(() => {
    if (!activePage) return [];
    const rows: Array<{ id: string; depth: number }> = [];
    const walk = (id: string, depth: number) => {
      const node = project.nodes[id];
      if (!node) return;
      rows.push({ id, depth });
      node.children.forEach(childId => walk(childId, depth + 1));
    };
    walk(activePage.rootNodeId, 0);
    return rows;
  }, [activePage, project.nodes]);

  const dropBefore = (event: DragEvent, targetId: string) => {
    event.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const target = project.nodes[targetId];
    if (!target?.parentId) return;
    const parent = project.nodes[target.parentId];
    if (!parent) return;
    const index = parent.children.indexOf(targetId);
    onMoveNode(draggedId, parent.id, index);
    setDraggedId(null);
  };

  return (
    <aside className="sidebar-panel" aria-label="Project panel">
      <div className="sidebar-tabs" role="tablist" aria-label="Project tools">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} className={`sidebar-tab ${activeTab === id ? "is-active" : ""}`} type="button" role="tab" aria-label={label} aria-selected={activeTab === id} onClick={() => setActiveTab(id)} title={label}>
            <Icon />
          </button>
        ))}
      </div>
      <div className="panel-header"><span>{tabs.find(tab => tab.id === activeTab)?.label}</span><span className="status-pill">Editable</span></div>
      <div className="sidebar-content">
        {activeTab === "layers" && (
          <div className="tree-list">
            {layerRows.map(({ id, depth }) => {
              const node = project.nodes[id]!;
              return (
                <button
                  key={id}
                  className={`tree-row ${selectedNodeId === id ? "is-selected" : ""}`}
                  type="button"
                  draggable={node.parentId !== null}
                  onDragStart={() => setDraggedId(id)}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => dropBefore(event, id)}
                  onClick={() => onSelectNode(id)}
                  style={{ paddingLeft: 7 + depth * 14 }}
                >
                  <span className="node-dot"/><span className="tree-label">{node.name}</span>
                  <span className="tree-actions">{node.locked ? <LockIcon/> : null}{node.visible ? <EyeIcon/> : null}</span>
                </button>
              );
            })}
          </div>
        )}
        {activeTab === "pages" && (
          <div className="tree-list">
            {Object.values(project.pages).map(page => <button key={page.id} className={`tree-row ${activePageId === page.id ? "is-selected" : ""}`} type="button" onClick={() => onSelectPage(page.id)}><span className="node-dot"/><span className="tree-label">{page.name}</span><span className="subtle-path">{page.path}</span></button>)}
          </div>
        )}
        {activeTab === "components" && (
          <div className="component-palette">
            {componentTemplates.map(item => <button key={item.type} type="button" className="component-card" onClick={() => onAddComponent(item.type)}><span className="node-dot"/><strong>{item.label}</strong><span>Add to selection</span></button>)}
          </div>
        )}
        {activeTab === "assets" && <div className="empty-state"><strong>No assets yet</strong><span>Asset management remains read-only until a later milestone.</span></div>}
      </div>
    </aside>
  );
}
