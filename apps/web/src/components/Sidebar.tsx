import { useMemo, useState, type DragEvent } from "react";
import type { DesignToken, ProjectDocument } from "../types";
import { componentTemplates } from "../editor";
import { AssetsIcon, ComponentsIcon, DesignIcon, EyeIcon, LayersIcon, LockIcon, PagesIcon } from "./Icons";

type Tab = "layers" | "pages" | "components" | "design" | "assets";
type TokenCategory = DesignToken["category"];

interface Props {
  project: ProjectDocument;
  activePageId: string | null;
  selectedNodeId: string | null;
  onSelectNode(nodeId: string): void;
  onSelectPage(pageId: string): void;
  onAddComponent(type: string): void;
  onInsertReusableComponent(componentId: string): void;
  onCreateReusableComponent(): void;
  onDeleteReusableComponent(componentId: string): void;
  onMoveNode(nodeId: string, parentId: string, index?: number): void;
  onUpsertToken(token: DesignToken): void;
  onDeleteToken(tokenId: string): void;
  onSetTheme(themeId: string): void;
  onCreateTheme(id: string, name: string): void;
  onDeleteTheme(themeId: string): void;
  onUpdateThemeToken(themeId: string, tokenId: string, value: string): void;
  onClearThemeToken(themeId: string, tokenId: string): void;
  onUpdateBreakpoint(id: string, value: number): void;
  onDeleteBreakpoint(id: string): void;
}

const tabs: Array<{ id: Tab; label: string; Icon: typeof LayersIcon }> = [
  { id: "layers", label: "Layers", Icon: LayersIcon },
  { id: "pages", label: "Pages", Icon: PagesIcon },
  { id: "components", label: "Components", Icon: ComponentsIcon },
  { id: "design", label: "Design", Icon: DesignIcon },
  { id: "assets", label: "Assets", Icon: AssetsIcon }
];

const tokenCategories: TokenCategory[] = [
  "color", "spacing", "radius", "typography", "shadow", "border", "opacity", "breakpoint", "zIndex", "motion"
];

function normalizeId(value: string, prefix: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || prefix;
}

export function Sidebar({
  project,
  activePageId,
  selectedNodeId,
  onSelectNode,
  onSelectPage,
  onAddComponent,
  onInsertReusableComponent,
  onCreateReusableComponent,
  onDeleteReusableComponent,
  onMoveNode,
  onUpsertToken,
  onDeleteToken,
  onSetTheme,
  onCreateTheme,
  onDeleteTheme,
  onUpdateThemeToken,
  onClearThemeToken,
  onUpdateBreakpoint,
  onDeleteBreakpoint
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("layers");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [newTokenId, setNewTokenId] = useState("");
  const [newTokenValue, setNewTokenValue] = useState("");
  const [newTokenCategory, setNewTokenCategory] = useState<TokenCategory>("color");
  const [newThemeName, setNewThemeName] = useState("");
  const [newBreakpointId, setNewBreakpointId] = useState("");
  const [newBreakpointValue, setNewBreakpointValue] = useState("1024");
  const activePage = activePageId ? project.pages[activePageId] : undefined;

  const layerRows = useMemo(() => {
    if (!activePage) return [];
    const rows: Array<{ id: string; depth: number }> = [];
    const walk = (id: string, depth: number) => {
      const node = project.nodes[id];
      if (!node) return;
      rows.push({ id, depth });
      if (!node.componentRef) node.children.forEach(childId => walk(childId, depth + 1));
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

  const activeTheme = project.settings.activeThemeId ? project.themes[project.settings.activeThemeId] : undefined;
  const sortedTokens = Object.values(project.tokens).sort((a, b) => a.id.localeCompare(b.id));
  const sortedBreakpoints = Object.entries(project.settings.breakpoints).sort((a, b) => a[1] - b[1]);
  const reusableComponents = Object.values(project.components).sort((a, b) => a.name.localeCompare(b.name));

  const createToken = () => {
    const id = newTokenId.trim();
    if (!id) return;
    onUpsertToken({ id, category: newTokenCategory, value: newTokenValue });
    setNewTokenId("");
    setNewTokenValue("");
  };

  const createTheme = () => {
    const name = newThemeName.trim();
    if (!name) return;
    const baseId = normalizeId(name, "theme");
    const id = baseId.startsWith("theme-") ? baseId : `theme-${baseId}`;
    if (project.themes[id]) return;
    onCreateTheme(id, name);
    setNewThemeName("");
  };

  const createBreakpoint = () => {
    const id = normalizeId(newBreakpointId, "breakpoint");
    const value = Number(newBreakpointValue);
    if (!newBreakpointId.trim() || !Number.isFinite(value) || value <= 0) return;
    onUpdateBreakpoint(id, value);
    setNewBreakpointId("");
  };

  return (
    <aside className="sidebar-panel" aria-label="Project panel">
      <div className="sidebar-tabs" role="tablist" aria-label="Project tools">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} className={`sidebar-tab ${activeTab === id ? "is-active" : ""}`} type="button" role="tab" aria-label={label} aria-selected={activeTab === id} onClick={() => setActiveTab(id)} title={label}><Icon /></button>
        ))}
      </div>
      <div className="panel-header"><span>{tabs.find(tab => tab.id === activeTab)?.label}</span><span className="status-pill">v0.5</span></div>
      <div className="sidebar-content">
        {activeTab === "layers" && <div className="tree-list">
          {layerRows.map(({ id, depth }) => {
            const node = project.nodes[id]!;
            return <button key={id} className={`tree-row ${selectedNodeId === id ? "is-selected" : ""}`} type="button" draggable={node.parentId !== null} onDragStart={() => setDraggedId(id)} onDragEnd={() => setDraggedId(null)} onDragOver={event => event.preventDefault()} onDrop={event => dropBefore(event, id)} onClick={() => onSelectNode(id)} style={{ paddingLeft: 7 + depth * 14 }}>
              <span className="node-dot"/><span className="tree-label">{node.name}</span>{node.componentRef ? <span className="component-chip">C</span> : null}<span className="tree-actions">{node.locked ? <LockIcon/> : null}{node.visible ? <EyeIcon/> : null}</span>
            </button>;
          })}
        </div>}

        {activeTab === "pages" && <div className="tree-list">
          {Object.values(project.pages).map(page => <button key={page.id} className={`tree-row ${activePageId === page.id ? "is-selected" : ""}`} type="button" onClick={() => onSelectPage(page.id)}><span className="node-dot"/><span className="tree-label">{page.name}</span><span className="subtle-path">{page.path}</span></button>)}
        </div>}

        {activeTab === "components" && <div className="component-palette">
          <div className="palette-heading">Core</div>
          {componentTemplates.map(item => <button key={item.type} type="button" className="component-card" onClick={() => onAddComponent(item.type)}><span className="node-dot"/><strong>{item.label}</strong><span>Add to selection</span></button>)}
          <div className="palette-heading with-action"><span>Reusable</span><button type="button" onClick={onCreateReusableComponent} disabled={!selectedNodeId}>From selection</button></div>
          {reusableComponents.length === 0 ? <div className="compact-empty">No reusable components yet.</div> : reusableComponents.map(component => (
            <div key={component.id} className="reusable-component-row">
              <button type="button" className="component-card reusable" onClick={() => onInsertReusableComponent(component.id)}><span className="node-dot"/><strong>{component.name}</strong><span>{component.id}</span></button>
              <button type="button" className="compact-danger" aria-label={`Delete ${component.name}`} onClick={() => onDeleteReusableComponent(component.id)}>×</button>
            </div>
          ))}
        </div>}

        {activeTab === "design" && <div className="design-panel">
          <section className="design-section">
            <div className="palette-heading">Theme</div>
            <div className="design-inline-row">
              <select className="design-select" value={project.settings.activeThemeId ?? ""} onChange={event => onSetTheme(event.target.value)}>
                <option value="">No theme</option>
                {Object.values(project.themes).sort((a, b) => a.name.localeCompare(b.name)).map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
              </select>
              <button type="button" className="compact-danger" disabled={!activeTheme} onClick={() => activeTheme && onDeleteTheme(activeTheme.id)} title={activeTheme ? "Delete active theme" : "No active theme"}>×</button>
            </div>
            <div className="design-create-row"><input placeholder="New theme name" value={newThemeName} onChange={event => setNewThemeName(event.target.value)}/><button type="button" onClick={createTheme}>Add</button></div>
            {activeTheme ? <div className="theme-overrides">
              {sortedTokens.map(token => {
                const overrideValue = activeTheme.tokenOverrides[token.id];
                return <label key={token.id}><span>{token.id}</span><div className="theme-token-row"><input value={overrideValue === undefined ? "" : String(overrideValue)} placeholder={`Base: ${String(token.value ?? "")}`} onChange={event => event.target.value === "" ? onClearThemeToken(activeTheme.id, token.id) : onUpdateThemeToken(activeTheme.id, token.id, event.target.value)}/>{overrideValue !== undefined ? <button type="button" onClick={() => onClearThemeToken(activeTheme.id, token.id)}>Reset</button> : null}</div></label>;
              })}
            </div> : null}
          </section>

          <section className="design-section">
            <div className="palette-heading">Tokens</div>
            <div className="token-list">{sortedTokens.map(token => <div key={token.id} className="token-row"><div><strong>{token.id}</strong><span>{token.category}</span></div><input value={String(token.value ?? "")} onChange={event => onUpsertToken({ ...token, value: event.target.value })}/><button type="button" onClick={() => onDeleteToken(token.id)}>×</button></div>)}</div>
            <div className="token-create token-create-expanded">
              <input placeholder="color.brand.primary" value={newTokenId} onChange={event => setNewTokenId(event.target.value)}/>
              <select value={newTokenCategory} onChange={event => setNewTokenCategory(event.target.value as TokenCategory)}>{tokenCategories.map(category => <option key={category} value={category}>{category}</option>)}</select>
              <input placeholder="#7c8cff" value={newTokenValue} onChange={event => setNewTokenValue(event.target.value)}/>
              <button type="button" onClick={createToken}>Add</button>
            </div>
          </section>

          <section className="design-section">
            <div className="palette-heading">Breakpoints</div>
            {sortedBreakpoints.map(([id, value]) => <div key={id} className="breakpoint-row"><span>{id}</span><input type="number" min="1" value={value} onChange={event => onUpdateBreakpoint(id, Number(event.target.value))}/><small>px</small><button type="button" className="compact-danger" onClick={() => onDeleteBreakpoint(id)}>×</button></div>)}
            <div className="breakpoint-create"><input placeholder="tablet" value={newBreakpointId} onChange={event => setNewBreakpointId(event.target.value)}/><input type="number" min="1" value={newBreakpointValue} onChange={event => setNewBreakpointValue(event.target.value)}/><button type="button" onClick={createBreakpoint}>Add</button></div>
          </section>
        </div>}

        {activeTab === "assets" && <div className="empty-state"><strong>No assets yet</strong><span>Asset management remains read-only until a later milestone.</span></div>}
      </div>
    </aside>
  );
}
