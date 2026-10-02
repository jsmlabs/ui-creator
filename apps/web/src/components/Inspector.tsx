import type { ChangeEvent } from "react";
import type { NodeStyle, ProjectDocument, ProjectNode, TokenOrValue } from "../types";
import { literal } from "../editor";

interface Props {
  project: ProjectDocument;
  node: ProjectNode | null;
  activeBreakpointId: string | null;
  onUpdate(changes: Partial<Pick<ProjectNode, "name" | "props" | "style" | "responsive" | "visible" | "locked" | "componentOverrides">>): void;
  onDelete(): void;
  onDuplicate(): void;
  onCreateReusable(): void;
}

function valueAsString(value: unknown): string { return value === null || value === undefined ? "" : String(value); }

function StyleValueField({ label, value, tokens, onChange }: { label: string; value: TokenOrValue | undefined; tokens: string[]; onChange(value: TokenOrValue | undefined): void }) {
  const literalText = value?.kind === "literal" ? valueAsString(value.value) : "";
  return (
    <div className="style-value-field">
      <label className="property-field"><span>{label}</span><input value={literalText} placeholder={value?.kind === "token" ? `Token: ${value.tokenId}` : "unset"} onChange={event => onChange(event.target.value.trim() ? literal(event.target.value.trim()) : undefined)}/></label>
      <select className="token-select" aria-label={`${label} token`} value={value?.kind === "token" ? value.tokenId : ""} onChange={event => onChange(event.target.value ? { kind: "token", tokenId: event.target.value } : undefined)}>
        <option value="">Literal / none</option>
        {tokens.map(id => <option key={id} value={id}>{id}</option>)}
      </select>
    </div>
  );
}

export function Inspector({ project, node, activeBreakpointId, onUpdate, onDelete, onDuplicate, onCreateReusable }: Props) {
  if (!node) {
    return <aside className="inspector-panel" aria-label="Inspector"><div className="panel-header"><span>Inspector</span><span className="status-pill">Design System</span></div><div className="empty-state inspector-empty"><strong>No selection</strong><span>Select a layer on the canvas or in the layer tree.</span></div></aside>;
  }

  const isInstance = Boolean(node.componentRef);
  const override = node.componentOverrides ?? { props: {}, style: {}, responsive: {} };
  const activeStyle: Partial<NodeStyle> = activeBreakpointId
    ? (isInstance ? override.responsive?.[activeBreakpointId] ?? {} : node.responsive[activeBreakpointId] ?? {})
    : (isInstance ? override.style ?? {} : node.style);

  const setStyleValue = (key: keyof NodeStyle, value?: TokenOrValue) => {
    if (activeBreakpointId) {
      if (isInstance) {
        const responsive = { ...(override.responsive ?? {}) };
        const current = { ...(responsive[activeBreakpointId] ?? {}) };
        if (value === undefined) delete current[key]; else (current as Record<string, unknown>)[key] = value;
        if (Object.keys(current).length === 0) delete responsive[activeBreakpointId]; else responsive[activeBreakpointId] = current;
        onUpdate({ componentOverrides: { ...override, responsive } });
      } else {
        const responsive = { ...node.responsive };
        const current = { ...(responsive[activeBreakpointId] ?? {}) };
        if (value === undefined) delete current[key]; else (current as Record<string, unknown>)[key] = value;
        if (Object.keys(current).length === 0) delete responsive[activeBreakpointId]; else responsive[activeBreakpointId] = current;
        onUpdate({ responsive });
      }
    } else if (isInstance) {
      const style = { ...(override.style ?? {}) };
      if (value === undefined) delete style[key]; else (style as Record<string, unknown>)[key] = value;
      onUpdate({ componentOverrides: { ...override, style } });
    } else {
      const style = { ...node.style };
      if (value === undefined) delete style[key]; else (style as Record<string, unknown>)[key] = value;
      onUpdate({ style });
    }
  };

  const setDisplay = (display: NonNullable<NodeStyle["display"]>) => {
    if (activeBreakpointId) {
      const responsive = isInstance ? { ...(override.responsive ?? {}) } : { ...node.responsive };
      const current = { ...(responsive[activeBreakpointId] ?? {}) };
      current.display = display;
      responsive[activeBreakpointId] = current;
      if (isInstance) onUpdate({ componentOverrides: { ...override, responsive } });
      else onUpdate({ responsive });
    } else if (isInstance) {
      onUpdate({ componentOverrides: { ...override, style: { ...(override.style ?? {}), display } } });
    } else onUpdate({ style: { ...node.style, display } });
  };

  const effectiveProps = isInstance ? { ...node.props, ...(override.props ?? {}) } : node.props;
  const setProp = (key: string, value: string | number) => {
    if (isInstance) onUpdate({ componentOverrides: { ...override, props: { ...(override.props ?? {}), [key]: value } } });
    else onUpdate({ props: { ...node.props, [key]: value } });
  };

  const tokenIds = Object.keys(project.tokens).sort();
  const colorTokens = tokenIds.filter(id => project.tokens[id]?.category === "color");
  const spacingTokens = tokenIds.filter(id => project.tokens[id]?.category === "spacing");
  const radiusTokens = tokenIds.filter(id => project.tokens[id]?.category === "radius");
  const typographyTokens = tokenIds.filter(id => project.tokens[id]?.category === "typography");
  const textProp = node.type === "text" || node.type === "button" ? "text" : node.type === "input" ? "placeholder" : null;
  const scope = activeBreakpointId ? `${activeBreakpointId} override` : isInstance ? "Component instance override" : "Base style";

  return (
    <aside className="inspector-panel" aria-label="Inspector">
      <div className="panel-header"><span>Inspector</span><span className="status-pill">{scope}</span></div>
      <div className="inspector-content">
        <div className="selection-summary">
          <span className="eyebrow">{isInstance ? "Component instance" : "Selected node"}</span>
          <input className="property-input node-name-input" aria-label="Node name" value={node.name} onChange={(event: ChangeEvent<HTMLInputElement>) => onUpdate({ name: event.target.value })}/>
          <code>{node.componentRef ? `component · ${node.componentRef}` : node.type}</code>
          <div className="selection-actions">
            <button type="button" onClick={onDuplicate}>Duplicate</button>
            {!isInstance ? <button type="button" onClick={onCreateReusable}>Make component</button> : null}
            <button type="button" className="danger" onClick={onDelete} disabled={node.parentId === null}>Delete</button>
          </div>
        </div>

        <section className="inspector-section">
          <div className="section-title">Responsive scope</div>
          <div className="scope-readout"><strong>{activeBreakpointId ?? "Base"}</strong><span>{activeBreakpointId ? `${project.settings.breakpoints[activeBreakpointId]}px and up` : "Default styles"}</span></div>
        </section>

        <section className="inspector-section">
          <div className="section-title">Layout</div>
          <label className="property-field"><span>Display</span><select value={activeStyle.display ?? "block"} onChange={event => setDisplay(event.target.value as NonNullable<NodeStyle["display"]>)}><option value="block">Block</option><option value="flex">Flex</option><option value="grid">Grid</option><option value="none">None</option></select></label>
          {!isInstance && !activeBreakpointId && node.style.display === "flex" ? <label className="property-field"><span>Direction</span><select value={valueAsString(effectiveProps.direction || "column")} onChange={event => setProp("direction", event.target.value)}><option value="column">Column</option><option value="row">Row</option></select></label> : null}
          {!isInstance && !activeBreakpointId && node.style.display === "grid" ? <label className="property-field"><span>Columns</span><input type="number" min="1" max="12" value={Number(effectiveProps.columns ?? 2)} onChange={event => setProp("columns", Number(event.target.value))}/></label> : null}
        </section>

        <section className="inspector-section"><div className="section-title">Size</div>
          <StyleValueField label="Width" value={activeStyle.width} tokens={spacingTokens} onChange={value => setStyleValue("width", value)}/>
          <StyleValueField label="Height" value={activeStyle.height} tokens={spacingTokens} onChange={value => setStyleValue("height", value)}/>
        </section>

        <section className="inspector-section"><div className="section-title">Spacing</div>
          <StyleValueField label="Padding" value={activeStyle.padding} tokens={spacingTokens} onChange={value => setStyleValue("padding", value)}/>
          <StyleValueField label="Margin" value={activeStyle.margin} tokens={spacingTokens} onChange={value => setStyleValue("margin", value)}/>
          <StyleValueField label="Gap" value={activeStyle.gap} tokens={spacingTokens} onChange={value => setStyleValue("gap", value)}/>
        </section>

        {textProp && !activeBreakpointId ? <section className="inspector-section"><div className="section-title">Content</div><label className="property-field"><span>{textProp === "text" ? "Text" : "Placeholder"}</span><input value={valueAsString(effectiveProps[textProp])} onChange={event => setProp(textProp, event.target.value)}/></label></section> : null}

        <section className="inspector-section"><div className="section-title">Typography</div>
          <StyleValueField label="Font size" value={activeStyle.fontSize} tokens={typographyTokens} onChange={value => setStyleValue("fontSize", value)}/>
          <StyleValueField label="Weight" value={activeStyle.fontWeight} tokens={typographyTokens} onChange={value => setStyleValue("fontWeight", value)}/>
          <StyleValueField label="Line height" value={activeStyle.lineHeight} tokens={typographyTokens} onChange={value => setStyleValue("lineHeight", value)}/>
          <StyleValueField label="Color" value={activeStyle.color} tokens={colorTokens} onChange={value => setStyleValue("color", value)}/>
        </section>

        <section className="inspector-section"><div className="section-title">Appearance</div>
          <StyleValueField label="Background" value={activeStyle.background} tokens={colorTokens} onChange={value => setStyleValue("background", value)}/>
          <StyleValueField label="Radius" value={activeStyle.borderRadius} tokens={radiusTokens} onChange={value => setStyleValue("borderRadius", value)}/>
          {!activeBreakpointId ? <div className="toggle-row"><label><input type="checkbox" checked={node.visible} onChange={event => onUpdate({ visible: event.target.checked })}/> Visible</label><label><input type="checkbox" checked={node.locked} onChange={event => onUpdate({ locked: event.target.checked })}/> Locked</label></div> : null}
        </section>
      </div>
    </aside>
  );
}
