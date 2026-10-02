import { type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { canAcceptChildren, resolveCssStyle } from "../editor";
import type { ProjectDocument, ProjectNode } from "../types";

interface Props {
  project: ProjectDocument;
  activePageId: string | null;
  selectedNodeId: string | null;
  onSelectNode(nodeId: string): void;
  onMoveNode(nodeId: string, parentId: string, index?: number): void;
  onResizeNode(nodeId: string, width: number, height: number): void;
}

function NodeRenderer({ project, node, selectedNodeId, onSelectNode, onMoveNode, onResizeNode }: Omit<Props, "activePageId"> & { node: ProjectNode }) {
  if (!node.visible) return null;
  const isSelected = selectedNodeId === node.id;
  const style = resolveCssStyle(node.style, node);
  const className = `render-node render-${node.type} ${isSelected ? "is-selected" : ""}`;

  const select = (event: MouseEvent) => {
    event.stopPropagation();
    onSelectNode(node.id);
  };

  const children = node.children
    .map(id => project.nodes[id])
    .filter((child): child is ProjectNode => Boolean(child))
    .map(child => <NodeRenderer key={child.id} project={project} node={child} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} onMoveNode={onMoveNode} onResizeNode={onResizeNode}/>);

  let content: ReactNode = children;
  if (node.type === "text") content = String(node.props.text ?? "Text");
  if (node.type === "button") content = <button type="button" className="runtime-button" tabIndex={-1}>{String(node.props.text ?? "Button")}</button>;
  if (node.type === "input") content = <input className="runtime-input" readOnly tabIndex={-1} placeholder={String(node.props.placeholder ?? "Input")}/>;

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
      {isSelected && !node.locked ? <button type="button" aria-label="Resize" className="node-resize-handle" onPointerDown={startResize}/> : null}
    </div>
  );
}

export function Canvas({ project, activePageId, selectedNodeId, onSelectNode, onMoveNode, onResizeNode }: Props) {
  const page = activePageId ? project.pages[activePageId] : undefined;
  const rootNode = page ? project.nodes[page.rootNodeId] : undefined;

  return (
    <main className="canvas-region">
      <div className="canvas-toolbar">
        <div className="viewport-control"><button type="button">Desktop</button><span>1440 × 900</span></div>
        <div className="canvas-hint">Drag layers into containers. Resize selected nodes from the lower-right handle.</div>
        <div className="zoom-control"><button type="button">−</button><span>100%</span><button type="button">+</button></div>
      </div>
      <div className="canvas-scroll-area">
        <div className="canvas-board" aria-label="Design canvas">
          <div className="canvas-frame-label">{page?.name ?? "No page"} <span>{page?.path}</span></div>
          <div className="page-frame" onClick={() => rootNode && onSelectNode(rootNode.id)}>
            {rootNode ? <NodeRenderer project={project} node={rootNode} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} onMoveNode={onMoveNode} onResizeNode={onResizeNode}/> : <div className="empty-page-content"><span className="canvas-kicker">DOM Canvas</span><h1>No active page</h1></div>}
          </div>
        </div>
      </div>
    </main>
  );
}
