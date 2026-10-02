import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import { createRuntimeState, executeInteraction, interactionsFor, isNodeRuntimeVisible, type RuntimeState } from "../../../../packages/runtime/src/index";
import { getComponentRoot, resolveCssStyle } from "../editor";
import type { ProjectDocument, ProjectNode } from "../types";

interface Props {
  project: ProjectDocument;
  onClose(): void;
}

function interpolate(value: unknown, state: RuntimeState): string {
  return String(value ?? "").replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, id: string) => String(state.variables[id.trim()] ?? ""));
}

function PreviewNode({ project, node, state, setState }: { project: ProjectDocument; node: ProjectNode; state: RuntimeState; setState(next: RuntimeState): void }) {
  const renderNode = node.componentRef ? getComponentRoot(project, node) ?? node : node;
  const style = resolveCssStyle(project, renderNode, null);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (state.focusTargetId === node.id) (ref.current as HTMLElement | null)?.focus?.();
    if (state.scrollTargetId === node.id) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [state.focusTargetId, state.scrollTargetId, node.id]);

  if (!isNodeRuntimeVisible(project, state, node.id)) return null;

  const run = (event: "click" | "change" | "submit" | "focus") => {
    let next = state;
    for (const interaction of interactionsFor(project, node.id, event)) next = executeInteraction(project, next, interaction);
    if (next !== state) setState(next);
  };

  const children = (node.componentRef ? (project.nodes[project.components[node.componentRef]?.rootNodeId ?? ""]?.children ?? []) : node.children)
    .map(id => project.nodes[id])
    .filter((child): child is ProjectNode => Boolean(child))
    .map(child => <PreviewNode key={child.id} project={project} node={child} state={state} setState={setState}/>);

  const common = { style, className: `preview-node preview-${renderNode.type}`, onClick: (event: MouseEvent) => { event.stopPropagation(); run("click"); } };
  if (renderNode.type === "text") return <div {...common}>{interpolate(renderNode.props.text ?? "Text", state)}</div>;
  if (renderNode.type === "button") return <button ref={ref as any} type="button" {...common}>{interpolate(renderNode.props.text ?? "Button", state)}</button>;
  if (renderNode.type === "input") return <input ref={ref as any} {...common} placeholder={interpolate(renderNode.props.placeholder ?? "Input", state)} onFocus={() => run("focus")} onChange={(_: ChangeEvent<HTMLInputElement>) => run("change")}/>;
  if (renderNode.type === "toggle") return <button ref={ref as any} type="button" {...common}>{interpolate(renderNode.props.label ?? "Toggle", state)}</button>;
  if (renderNode.type === "form") return <form ref={ref as any} style={style} className="preview-node preview-form" onSubmit={event => { event.preventDefault(); run("submit"); }}>{children}</form>;
  return <div ref={ref as any} {...common}>{children}</div>;
}

export function Preview({ project, onClose }: Props) {
  const [runtime, setRuntime] = useState(() => createRuntimeState(project));
  const page = runtime.activePageId ? project.pages[runtime.activePageId] : undefined;
  const root = page ? project.nodes[page.rootNodeId] : undefined;
  const variables = useMemo(() => Object.entries(runtime.variables).sort(([a], [b]) => a.localeCompare(b)), [runtime.variables]);

  return <div className="preview-overlay" role="dialog" aria-label="Interactive preview">
    <header className="preview-toolbar"><div><strong>Interactive Preview</strong><span>{page?.name ?? "No page"} · runtime state is temporary</span></div><div className="preview-actions"><button type="button" onClick={() => setRuntime(createRuntimeState(project))}>Reset</button><button type="button" className="primary" onClick={onClose}>Back to editor</button></div></header>
    <div className="preview-runtime-bar"><span>Runtime variables</span>{variables.length === 0 ? <em>none</em> : variables.map(([id, value]) => <code key={id}>{id}={String(value)}</code>)}</div>
    <main className="preview-stage">{root ? <PreviewNode project={project} node={root} state={runtime} setState={setRuntime}/> : <div className="compact-empty">No active runtime page.</div>}</main>
  </div>;
}
