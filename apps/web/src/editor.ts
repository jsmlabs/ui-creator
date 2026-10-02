import { createNode } from "../../../packages/schema/src/factory";
import type { CSSProperties } from "react";
import type { NodeStyle, Project, StylePrimitive, TokenOrValue, UINode } from "../../../packages/schema/src/types";

export const componentTemplates = [
  { type: "container", label: "Container" },
  { type: "stack", label: "Stack" },
  { type: "grid", label: "Grid" },
  { type: "text", label: "Text" },
  { type: "button", label: "Button" },
  { type: "input", label: "Input" },
  { type: "form", label: "Form" },
  { type: "modal", label: "Modal" },
  { type: "drawer", label: "Drawer" },
  { type: "toggle", label: "Toggle" },
  { type: "tabs", label: "Tabs" }
] as const;

export function literal(value: StylePrimitive): TokenOrValue { return { kind: "literal", value }; }
export function token(tokenId: string): TokenOrValue { return { kind: "token", tokenId }; }

export function literalValue(value: TokenOrValue | undefined, fallback = ""): StylePrimitive {
  return value?.kind === "literal" ? value.value : fallback;
}

export function createComponentNode(type: string): UINode {
  const base = createNode({ type, name: type[0]!.toUpperCase() + type.slice(1) });
  if (type === "stack") {
    base.style = { display: "flex", gap: token("spacing.sm"), padding: token("spacing.md") };
    base.props = { direction: "column" };
  } else if (type === "grid") {
    base.style = { display: "grid", gap: token("spacing.sm"), padding: token("spacing.md") };
    base.props = { columns: 2 };
  } else if (type === "container") {
    base.style = { display: "block", padding: token("spacing.md") };
  } else if (type === "text") {
    base.props = { text: "Text" };
    base.style = { color: token("color.text.primary") };
  } else if (type === "button") {
    base.props = { text: "Button" };
    base.style = { padding: literal("10px 14px"), borderRadius: token("radius.md"), background: token("color.accent.primary"), color: literal("#ffffff") };
  } else if (type === "input") {
    base.props = { placeholder: "Input" };
    base.style = { padding: literal("10px 12px"), borderRadius: token("radius.md"), background: token("color.surface.control"), color: token("color.text.primary") };
  } else if (type === "form") {
    base.style = { display: "flex", gap: token("spacing.sm"), padding: token("spacing.md") };
    base.props = { direction: "column" };
  } else if (type === "modal") {
    base.style = { display: "flex", gap: token("spacing.sm"), padding: token("spacing.md"), background: token("color.surface.control"), borderRadius: token("radius.md") };
    base.props = { direction: "column" };
  } else if (type === "drawer") {
    base.style = { display: "flex", gap: token("spacing.sm"), padding: token("spacing.md"), background: token("color.surface.control") };
    base.props = { direction: "column" };
  } else if (type === "toggle") {
    base.props = { label: "Toggle" };
    base.style = { padding: literal("8px 12px"), borderRadius: token("radius.md"), background: token("color.surface.control"), color: token("color.text.primary") };
  } else if (type === "tabs") {
    base.props = { activeTab: "Tab 1" };
    base.style = { display: "flex", gap: token("spacing.sm"), padding: token("spacing.sm") };
  }
  return base;
}

export function createComponentInstance(project: Project, componentId: string): UINode {
  const definition = project.components[componentId];
  if (!definition) throw new Error(`Component ${componentId} does not exist.`);
  return createNode({
    type: "component-instance",
    name: definition.name,
    componentRef: componentId,
    componentOverrides: { props: {}, style: {}, responsive: {} }
  });
}

export function resolveTokenValue(project: Project, value: TokenOrValue | undefined): StylePrimitive | undefined {
  if (!value) return undefined;
  if (value.kind === "literal") return value.value;
  const themeId = project.settings.activeThemeId;
  const themed = themeId ? project.themes[themeId]?.tokenOverrides[value.tokenId] : undefined;
  return themed !== undefined ? themed : project.tokens[value.tokenId]?.value;
}

export function resolveEffectiveStyle(project: Project, node: UINode, breakpointId: string | null): NodeStyle {
  const base: NodeStyle = { ...node.style, ...(node.componentOverrides?.style ?? {}) };
  if (!breakpointId) return base;
  const target = project.settings.breakpoints[breakpointId];
  if (target === undefined) return base;
  const ordered = Object.entries(project.settings.breakpoints).sort((a, b) => a[1] - b[1]);
  for (const [id, width] of ordered) {
    if (width > target) break;
    Object.assign(base, node.responsive[id] ?? {}, node.componentOverrides?.responsive?.[id] ?? {});
  }
  return base;
}

export function resolveCssStyle(project: Project, node: UINode, breakpointId: string | null = null): CSSProperties {
  const style = resolveEffectiveStyle(project, node, breakpointId);
  const css: CSSProperties = {};
  const get = (value: TokenOrValue | undefined): string | number | undefined => {
    const resolved = resolveTokenValue(project, value);
    return typeof resolved === "boolean" || resolved === null ? undefined : resolved;
  };
  if (style.display) css.display = style.display;
  css.width = get(style.width);
  css.height = get(style.height);
  css.padding = get(style.padding);
  css.margin = get(style.margin);
  css.gap = get(style.gap);
  css.background = get(style.background);
  const color = get(style.color);
  css.color = typeof color === "string" ? color : undefined;
  css.borderRadius = get(style.borderRadius);
  css.fontSize = get(style.fontSize);
  css.fontWeight = get(style.fontWeight) as CSSProperties["fontWeight"];
  css.lineHeight = get(style.lineHeight);
  css.textAlign = get(style.textAlign) as CSSProperties["textAlign"];
  if (style.display === "flex") {
    css.flexDirection = node.props.direction === "row" ? "row" : "column";
    css.alignItems = "stretch";
  }
  if (style.display === "grid") {
    const columns = Number(node.props.columns ?? 2);
    css.gridTemplateColumns = `repeat(${Number.isFinite(columns) && columns > 0 ? columns : 2}, minmax(0, 1fr))`;
  }
  return css;
}

export function getComponentRoot(project: Project, instance: UINode): UINode | null {
  if (!instance.componentRef) return null;
  const definition = project.components[instance.componentRef];
  const root = definition ? project.nodes[definition.rootNodeId] : undefined;
  if (!root) return null;
  const merged: UINode = {
    ...root,
    id: instance.id,
    name: instance.name,
    parentId: instance.parentId,
    props: { ...root.props, ...(instance.componentOverrides?.props ?? {}) },
    style: { ...root.style, ...(instance.componentOverrides?.style ?? {}) },
    responsive: { ...root.responsive, ...(instance.componentOverrides?.responsive ?? {}) },
    visible: instance.componentOverrides?.visible ?? instance.visible,
    locked: instance.locked,
    componentRef: instance.componentRef
  };
  if (instance.componentOverrides) merged.componentOverrides = instance.componentOverrides;
  return merged;
}

export function canAcceptChildren(node: UINode): boolean {
  return !node.componentRef && ["container", "stack", "grid", "form", "modal", "drawer", "tabs"].includes(node.type);
}

export function getDefaultParent(project: Project, selectedNodeId: string | null, activePageId: string | null): string | null {
  const selected = selectedNodeId ? project.nodes[selectedNodeId] : undefined;
  if (selected && canAcceptChildren(selected)) return selected.id;
  if (selected?.parentId) return selected.parentId;
  const page = activePageId ? project.pages[activePageId] : undefined;
  return page?.rootNodeId ?? null;
}
