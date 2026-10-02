export const CURRENT_SCHEMA_VERSION = 2 as const;
export type ProjectSchemaVersion = typeof CURRENT_SCHEMA_VERSION;
export type StylePrimitive = string | number | boolean | null;

export interface TokenReference { kind: "token"; tokenId: string; }
export interface LiteralValue { kind: "literal"; value: StylePrimitive; }
export type TokenOrValue = TokenReference | LiteralValue;

export interface NodeStyle {
  display?: "block" | "flex" | "grid" | "none";
  width?: TokenOrValue;
  height?: TokenOrValue;
  padding?: TokenOrValue;
  margin?: TokenOrValue;
  gap?: TokenOrValue;
  background?: TokenOrValue;
  color?: TokenOrValue;
  borderRadius?: TokenOrValue;
  fontSize?: TokenOrValue;
  fontWeight?: TokenOrValue;
  lineHeight?: TokenOrValue;
  textAlign?: TokenOrValue;
}

export type ResponsiveOverrides = Record<string, Partial<NodeStyle>>;
export type NodeStates = Record<string, Partial<NodeStyle>>;

export interface ComponentOverrides {
  props?: Record<string, unknown>;
  style?: Partial<NodeStyle>;
  responsive?: ResponsiveOverrides;
  visible?: boolean;
}

export interface UINode {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
  children: string[];
  props: Record<string, unknown>;
  style: NodeStyle;
  responsive: ResponsiveOverrides;
  states: NodeStates;
  visible: boolean;
  locked: boolean;
  componentRef?: string;
  componentOverrides?: ComponentOverrides;
}

export interface PageMetadata { title?: string; description?: string; }
export interface Page { id: string; name: string; path: string; rootNodeId: string; metadata: PageMetadata; }
export interface ComponentDefinition { id: string; name: string; rootNodeId: string; props: Record<string, unknown>; }
export interface DesignToken {
  id: string;
  category: "color" | "spacing" | "radius" | "typography" | "shadow" | "border" | "opacity" | "breakpoint" | "zIndex" | "motion";
  value: StylePrimitive;
}
export interface Theme { id: string; name: string; tokenOverrides: Record<string, StylePrimitive>; }
export interface RuntimeVariable { id: string; name: string; value: unknown; }
export interface InteractionAction {
  type: "navigate" | "open" | "close" | "toggle" | "setVariable" | "updateVariable" | "submit" | "reset" | "focus" | "scrollTo";
  payload: Record<string, unknown>;
}
export interface Interaction { id: string; sourceNodeId: string; event: string; actions: InteractionAction[]; }
export interface AssetReference { id: string; path: string; mimeType: string; size: number; }
export interface ProjectMetadata { createdAt: string; updatedAt: string; }
export interface ProjectSettings { activeThemeId: string | null; breakpoints: Record<string, number>; }

export interface Project {
  schemaVersion: ProjectSchemaVersion;
  id: string;
  name: string;
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  pages: Record<string, Page>;
  nodes: Record<string, UINode>;
  components: Record<string, ComponentDefinition>;
  tokens: Record<string, DesignToken>;
  themes: Record<string, Theme>;
  variables: Record<string, RuntimeVariable>;
  interactions: Record<string, Interaction>;
  assets: Record<string, AssetReference>;
  rootPageId: string | null;
}
