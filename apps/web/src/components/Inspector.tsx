import type { ChangeEvent } from "react";
import type { NodeStyle, ProjectNode } from "../types";
import { literal, literalValue } from "../editor";

interface Props {
  node: ProjectNode | null;
  onUpdate(changes: Partial<Pick<ProjectNode, "name" | "props" | "style" | "visible" | "locked">>): void;
  onDelete(): void;
  onDuplicate(): void;
}

function valueAsString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function Inspector({ node, onUpdate, onDelete, onDuplicate }: Props) {
  if (!node) {
    return <aside className="inspector-panel" aria-label="Inspector"><div className="panel-header"><span>Inspector</span><span className="status-pill">Editable</span></div><div className="empty-state inspector-empty"><strong>No selection</strong><span>Select a layer on the canvas or in the layer tree.</span></div></aside>;
  }

  const setStyle = (key: keyof NodeStyle, value: string) => {
    const next = { ...node.style };
    if (!value.trim()) delete next[key];
    else (next as Record<string, unknown>)[key] = literal(value.trim());
    onUpdate({ style: next });
  };

  const setProp = (key: string, value: string | number) => onUpdate({ props: { ...node.props, [key]: value } });
  const textProp = node.type === "text" || node.type === "button" ? "text" : node.type === "input" ? "placeholder" : null;

  return (
    <aside className="inspector-panel" aria-label="Inspector">
      <div className="panel-header"><span>Inspector</span><span className="status-pill">Editable</span></div>
      <div className="inspector-content">
        <div className="selection-summary">
          <span className="eyebrow">Selected node</span>
          <input className="property-input node-name-input" aria-label="Node name" value={node.name} onChange={(event: ChangeEvent<HTMLInputElement>) => onUpdate({ name: event.target.value })}/>
          <code>{node.type}</code>
          <div className="selection-actions"><button type="button" onClick={onDuplicate}>Duplicate</button><button type="button" className="danger" onClick={onDelete} disabled={node.parentId === null}>Delete</button></div>
        </div>

        <section className="inspector-section">
          <div className="section-title">Layout</div>
          <label className="property-field"><span>Display</span><select value={node.style.display ?? "block"} onChange={event => onUpdate({ style: { ...node.style, display: event.target.value as NodeStyle["display"] } })}><option value="block">Block</option><option value="flex">Flex</option><option value="grid">Grid</option><option value="none">None</option></select></label>
          {node.style.display === "flex" && <label className="property-field"><span>Direction</span><select value={valueAsString(node.props.direction || "column")} onChange={event => setProp("direction", event.target.value)}><option value="column">Column</option><option value="row">Row</option></select></label>}
          {node.style.display === "grid" && <label className="property-field"><span>Columns</span><input type="number" min="1" max="12" value={Number(node.props.columns ?? 2)} onChange={event => setProp("columns", Number(event.target.value))}/></label>}
        </section>

        <section className="inspector-section">
          <div className="section-title">Size</div>
          <label className="property-field"><span>Width</span><input value={valueAsString(literalValue(node.style.width))} placeholder="auto" onChange={event => setStyle("width", event.target.value)}/></label>
          <label className="property-field"><span>Height</span><input value={valueAsString(literalValue(node.style.height))} placeholder="auto" onChange={event => setStyle("height", event.target.value)}/></label>
        </section>

        <section className="inspector-section">
          <div className="section-title">Spacing</div>
          <label className="property-field"><span>Padding</span><input value={valueAsString(literalValue(node.style.padding))} placeholder="0" onChange={event => setStyle("padding", event.target.value)}/></label>
          <label className="property-field"><span>Margin</span><input value={valueAsString(literalValue(node.style.margin))} placeholder="0" onChange={event => setStyle("margin", event.target.value)}/></label>
          <label className="property-field"><span>Gap</span><input value={valueAsString(literalValue(node.style.gap))} placeholder="0" onChange={event => setStyle("gap", event.target.value)}/></label>
        </section>

        {textProp && <section className="inspector-section"><div className="section-title">Content</div><label className="property-field"><span>{textProp === "text" ? "Text" : "Placeholder"}</span><input value={valueAsString(node.props[textProp])} onChange={event => setProp(textProp, event.target.value)}/></label></section>}

        <section className="inspector-section">
          <div className="section-title">Typography</div>
          <label className="property-field"><span>Font size</span><input value={valueAsString(literalValue(node.style.fontSize))} placeholder="inherit" onChange={event => setStyle("fontSize", event.target.value)}/></label>
          <label className="property-field"><span>Weight</span><input value={valueAsString(literalValue(node.style.fontWeight))} placeholder="inherit" onChange={event => setStyle("fontWeight", event.target.value)}/></label>
          <label className="property-field"><span>Line height</span><input value={valueAsString(literalValue(node.style.lineHeight))} placeholder="normal" onChange={event => setStyle("lineHeight", event.target.value)}/></label>
          <label className="property-field"><span>Align</span><select value={valueAsString(literalValue(node.style.textAlign, "left"))} onChange={event => setStyle("textAlign", event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        </section>

        <section className="inspector-section">
          <div className="section-title">Appearance</div>
          <label className="property-field"><span>Background</span><input value={valueAsString(literalValue(node.style.background))} placeholder="transparent" onChange={event => setStyle("background", event.target.value)}/></label>
          <label className="property-field"><span>Color</span><input value={valueAsString(literalValue(node.style.color))} placeholder="inherit" onChange={event => setStyle("color", event.target.value)}/></label>
          <label className="property-field"><span>Radius</span><input value={valueAsString(literalValue(node.style.borderRadius))} placeholder="0" onChange={event => setStyle("borderRadius", event.target.value)}/></label>
          <div className="toggle-row"><label><input type="checkbox" checked={node.visible} onChange={event => onUpdate({ visible: event.target.checked })}/> Visible</label><label><input type="checkbox" checked={node.locked} onChange={event => onUpdate({ locked: event.target.checked })}/> Locked</label></div>
        </section>
      </div>
    </aside>
  );
}
