import { type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { canAcceptChildren, getComponentRoot, resolveCssStyle } from "../editor";
import type { ProjectDocument, ProjectNode } from "../types";

interface Props {
  project: ProjectDocument;
  activePageId: string | null;
  activeBreakpointId: string | null;
  selectedNodeId: string | null;
  onSelectNode(nodeId: string): void;
  onMoveNode(nodeId: string, parentId: string, index?: number): void;
  onResizeNode(nodeId: string, width: number, height: number): void;
  onBreakpointChange(breakpointId: string | null): void;
}

interface RendererProps extends Omit<Props, "activePageId" | "onBreakpointChange"> {
  node: ProjectNode;
  interactive?: boolean;
}

function DefinitionNode({ project, node, activeBreakpointId }: Pick<RendererProps, "project" | "node" | "activeBreakpointId">) {
  if (!node.visible) return null;
  const style = resolveCssStyle(project, node, activeBreakpointId);
  const children = node.children.map(id => project.nodes[id]).filter((child): child is ProjectNode => Boolean(child));
  let content: ReactNode = children.map(child => <DefinitionNode key={child.id} project={project} node={child} activeBreakpointId={activeBreakpointId}/>);
  if (node.type === "text") content = String(node.props.text ?? "Text");
  if (node.type === "button") content = <button type="button" className="runtime-button" tabIndex={-1}>{String(node.props.text ?? "Button")}</button>;
  if (node.type === "input") content = <input className="runtime-input" readOnly tabIndex={-1} placeholder={String(node.props.placeholder ?? "Input")}/>;
  return <div className={`render-node render-${node.type} component-definition-node`} style={style}>{content}</div>;
}

function NodeRenderer({ project, node, activeBreakpointId, selectedNodeId, onSelectNode, onMoveNode, onResizeNode }: RendererProps) {
  if (!node.visible) return null;
  const renderNode = node.componentRef ? getComponentRoot(project, node) ?? node : node;
  const isSelected = selectedNodeId === node.id;
  const style = resolveCssStyle(project, renderNode, activeBreakpointId);
  const className = `render-node render-${renderNode.type} ${node.componentRef ? "is-component-instance" : ""} ${isSelected ? "is-selected" : ""}`;

  const select = (event: MouseEvent) => {
    event.stopPropagation();
    onSelectNode(node.id);
  };

  let content: ReactNode;
  if (node.componentRef) {
    const definition = project.components[node.componentRef];
    const definitionRoot = definition ? project.nodes[definition.rootNodeId] : undefined;
    if (!definitionRoot) content = <div className="component-missing">Missing component</div>;
    else {
      const mergedRoot = getComponentRoot(project, node) ?? definitionRoot;
      const directChildren = definitionRoot.children.map(id => project.nodes[id]).filter((child): child is ProjectNode => Boolean(child));
      if (mergedRoot.type === "text") content = String(mergedRoot.props.text ?? "Text");
      else if (mergedRoot.type === "button") content = <button type="button" className="runtime-button" tabIndex={-1}>{String(mergedRoot.props.text ?? "Button")}</button>;
      else if (mergedRoot.type === "input") content = <input className="runtime-input" readOnly tabIndex={-1} placeholder={String(mergedRoot.props.placeholder ?? "Input")}/>;
      else content = directChildren.map(child => <DefinitionNode key={child.id} project={project} node={child} activeBreakpointId={activeBreakpointId}/>);
    }
  } else {
    const children = node.children
      .map(id => project.nodes[id])
      .filter((child): child is ProjectNode => Boolean(child))
      .map(child => <NodeRenderer key={child.id} project={project} node={child} activeBreakpointId={activeBreakpointId} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} onMoveNode={onMoveNode} onResizeNode={onResizeNode}/>);
    content = children;
    if (node.type === "text") content = String(node.props.text ?? "Text");
    if (node.type === "button") content = <button type="button" className="runtime-button" tabIndex={-1}>{String(node.props.text ?? "Button")}</button>;
    if (node.type === "input") content = <input className="runtime-input" readOnly tabIndex={-1} placeholder={String(node.props.placeholder ?? "Input")}/>;
  }

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget.parentElement;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (move: PointerEvent) => {
      element.style.width = `${Math.max(40, rect.width + move.clientX - startX)}px`;
      element.style.height = `${Math.max(24, rect.height + move.clientY - startY)}px`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      const final = element.getBoundingClientRect();
      onResizeNode(node.id, final.width, final.height);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div
      className={className}
      data-node-name={node.name}
      style={style}
      draggable={node.parentId !== null && !node.locked}
      onClick={select}
      onDragStart={(event: DragEvent) => { event.stopPropagation(); event.dataTransfer.setData("text/ui-node", node.id); }}
      onDragOver={(event: DragEvent) => { if (canAcceptChildren(node)) event.preventDefault(); }}
      onDrop={(event: DragEvent) => {
        if (!canAcceptChildren(node)) return;
        event.preventDefault();
        event.stopPropagation();
        const id = event.dataTransfer.getData("text/ui-node");
        if (id && id !== node.id) onMoveNode(id, node.id);
      }}
    >
      {content}
      {node.componentRef ? <span className="component-instance-badge">Component</span> : null}
      {isSelected && !node.locked ? <button type="button" aria-label="Resize" className="node-resize-handle" onPointerDown={startResize}/> : null}
    </div>
  );
}

export function Canvas({ project, activePageId, activeBreakpointId, selectedNodeId, onSelectNode, onMoveNode, onResizeNode, onBreakpointChange }: Props) {
  const page = activePageId ? project.pages[activePageId] : undefined;
  const rootNode = page ? project.nodes[page.rootNodeId] : undefined;
  const breakpoints = Object.entries(project.settings.breakpoints).sort((a, b) => a[1] - b[1]);
  const width = activeBreakpointId ? project.settings.breakpoints[activeBreakpointId] : 1080;

  return (
    <main className="canvas-region">
      <div className="canvas-toolbar">
        <div className="viewport-control">
          <select aria-label="Responsive breakpoint" value={activeBreakpointId ?? "base"} onChange={event => onBreakpointChange(event.target.value === "base" ? null : event.target.value)}>
            <option value="base">Base / Fluid</option>
            {breakpoints.map(([id, value]) => <option key={id} value={id}>{id} · {value}px</option>)}
          </select>
          <span>{activeBreakpointId ? `${width}px` : "Fluid"}</span>
        </div>
        <div className="canvas-hint">Base styles cascade into breakpoint overrides. Component instances share their source definition.</div>
        <div className="zoom-control"><button type="button">−</button><span>100%</span><button type="button">+</button></div>
      </div>
      <div className="canvas-scroll-area">
        <div className="canvas-board" aria-label="Design canvas">
          <div className="canvas-frame-label">{page?.name ?? "No page"} <span>{page?.path}</span></div>
          <div className="page-frame" style={{ width: activeBreakpointId ? `${Math.min(width ?? 1080, 1080)}px` : undefined }} onClick={() => rootNode && onSelectNode(rootNode.id)}>
            {rootNode ? <NodeRenderer project={project} node={rootNode} activeBreakpointId={activeBreakpointId} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} onMoveNode={onMoveNode} onResizeNode={onResizeNode}/> : <div className="empty-page-content"><span className="canvas-kicker">DOM Canvas</span><h1>No active page</h1></div>}
          </div>
        </div>
      </div>
    </main>
  );
}
