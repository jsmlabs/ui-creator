import { createId } from "../../shared/src/index.js";
import { CURRENT_SCHEMA_VERSION, type Page, type Project, type UINode } from "./types.js";

const DEFAULT_BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 } as const;

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
    ...(input.componentRef === undefined ? {} : { componentRef: input.componentRef })
  };
}

export function createPage(name: string, path = "/"): { page: Page; rootNode: UINode } {
  const pageId = createId("page");
  const rootNode = createNode({ type: "container", name: `${name} Root` });
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
    settings: { activeThemeId: null, breakpoints: { ...DEFAULT_BREAKPOINTS } },
    pages: { [page.id]: page },
    nodes: { [rootNode.id]: rootNode },
    components: {}, tokens: {}, themes: {}, variables: {}, interactions: {}, assets: {},
    rootPageId: page.id
  };
}
