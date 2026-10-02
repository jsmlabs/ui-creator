import { createNode } from "../../../packages/schema/src/factory";
import type { CSSProperties } from "react";
import type { NodeStyle, Project, StylePrimitive, TokenOrValue, UINode } from "../../../packages/schema/src/types";

export const componentTemplates = [
  { type: "container", label: "Container" },
  { type: "stack", label: "Stack" },
  { type: "grid", label: "Grid" },
  { type: "text", label: "Text" },
  { type: "button", label: "Button" },
  { type: "input", label: "Input" }
] as const;

export function literal(value: StylePrimitive): TokenOrValue {
  return { kind: "literal", value };
}

export function literalValue(value: TokenOrValue | undefined, fallback = ""): StylePrimitive {
  return value?.kind === "literal" ? value.value : fallback;
}

export function createComponentNode(type: string): UINode {
  const base = createNode({ type, name: type[0]!.toUpperCase() + type.slice(1) });
  if (type === "stack") {
    base.style = { display: "flex", gap: literal("12px"), padding: literal("16px") };
    base.props = { direction: "column" };
  } else if (type === "grid") {
    base.style = { display: "grid", gap: literal("12px"), padding: literal("16px") };
    base.props = { columns: 2 };
  } else if (type === "container") {
    base.style = { display: "block", padding: literal("16px") };
  } else if (type === "text") {
    base.props = { text: "Text" };
  } else if (type === "button") {
    base.props = { text: "Button" };
    base.style = { padding: literal("10px 14px"), borderRadius: literal("6px"), background: literal("#272d66"), color: literal("#eef0ff") };
  } else if (type === "input") {
    base.props = { placeholder: "Input" };
    base.style = { padding: literal("10px 12px"), borderRadius: literal("6px"), background: literal("#17171b"), color: literal("#e4e4e7") };
  }
  return base;
}

export function resolveCssStyle(style: NodeStyle, node?: UINode): CSSProperties {
  const css: CSSProperties = {};
  const get = (value: TokenOrValue | undefined): string | number | undefined => {
    if (!value || value.kind !== "literal") return undefined;
    return typeof value.value === "boolean" || value.value === null ? undefined : value.value;
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
    css.flexDirection = node?.props.direction === "row" ? "row" : "column";
    css.alignItems = "stretch";
  }
  if (style.display === "grid") {
    const columns = Number(node?.props.columns ?? 2);
    css.gridTemplateColumns = `repeat(${Number.isFinite(columns) && columns > 0 ? columns : 2}, minmax(0, 1fr))`;
  }
  return css;
}

export function canAcceptChildren(node: UINode): boolean {
  return node.type === "container" || node.type === "stack" || node.type === "grid";
}

export function getDefaultParent(project: Project, selectedNodeId: string | null, activePageId: string | null): string | null {
  const selected = selectedNodeId ? project.nodes[selectedNodeId] : undefined;
  if (selected && canAcceptChildren(selected)) return selected.id;
  if (selected?.parentId) return selected.parentId;
  const page = activePageId ? project.pages[activePageId] : undefined;
  return page?.rootNodeId ?? null;
}
