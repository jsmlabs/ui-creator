import { createId } from "../../shared/src/index.js";
import { DEFAULT_BREAKPOINTS, DEFAULT_THEMES, DEFAULT_TOKENS } from "./defaults.js";
import { CURRENT_SCHEMA_VERSION, type Page, type Project, type UINode } from "./types.js";

export function createNode(input: Partial<UINode> & Pick<UINode, "type" | "name">): UINode {
  return {
    id: input.id ?? createId("node"),
    type: input.type,
    name: input.name,
    parentId: input.parentId ?? null,
    children: input.children ?? [],
    props: input.props ?? {},
    style: input.style ?? {},
    responsive: input.responsive ?? {},
    states: input.states ?? {},
    visible: input.visible ?? true,
    locked: input.locked ?? false,
    ...(input.componentRef === undefined ? {} : { componentRef: input.componentRef }),
    ...(input.componentOverrides === undefined ? {} : { componentOverrides: input.componentOverrides })
  };
}

export function createPage(name: string, path = "/"): { page: Page; rootNode: UINode } {
  const pageId = createId("page");
  const rootNode = createNode({
    type: "container",
    name: `${name} Root`,
    style: {
      display: "flex",
      padding: { kind: "token", tokenId: "spacing.md" },
      gap: { kind: "token", tokenId: "spacing.sm" },
      background: { kind: "token", tokenId: "color.surface.canvas" },
      color: { kind: "token", tokenId: "color.text.primary" }
    },
    props: { direction: "column" }
  });
  return { page: { id: pageId, name, path, rootNodeId: rootNode.id, metadata: {} }, rootNode };
}

export function createProject(name: string, now = new Date()): Project {
  const timestamp = now.toISOString();
  const { page, rootNode } = createPage("Home", "/");
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: createId("project"),
    name,
    metadata: { createdAt: timestamp, updatedAt: timestamp },
    settings: { activeThemeId: "theme-dark", breakpoints: { ...DEFAULT_BREAKPOINTS } },
    pages: { [page.id]: page },
    nodes: { [rootNode.id]: rootNode },
    components: {},
    tokens: structuredClone(DEFAULT_TOKENS),
    themes: structuredClone(DEFAULT_THEMES),
    variables: {}, interactions: {}, assets: {},
    rootPageId: page.id
  };
}
