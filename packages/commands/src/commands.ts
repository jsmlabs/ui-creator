import { clone, createId } from "../../shared/src/index.js";
import type { ComponentDefinition, DesignToken, Page, Project, Theme, UINode } from "../../schema/src/index.js";
import { validateProjectOrThrow } from "../../validation/src/index.js";
import { CommandExecutionError, type Command, type CommandResult } from "./types.js";

function withValidation(project: Project, inverse: Command): CommandResult {
  validateProjectOrThrow(project);
  return { project, inverse };
}

export class CreateNodeCommand implements Command {
  readonly type = "createNode";
  constructor(private readonly node: UINode, private readonly parentId: string, private readonly index?: number) {}
  execute(project: Project): CommandResult {
    if (project.nodes[this.node.id]) throw new CommandExecutionError(`Node ${this.node.id} already exists.`);
    const parent = project.nodes[this.parentId];
    if (!parent) throw new CommandExecutionError(`Parent node ${this.parentId} does not exist.`);
    const next = clone(project);
    const nextParent = next.nodes[this.parentId]!;
    const node = clone(this.node);
    node.parentId = this.parentId;
    const insertionIndex = this.index ?? nextParent.children.length;
    if (insertionIndex < 0 || insertionIndex > nextParent.children.length) throw new CommandExecutionError(`Invalid insertion index ${insertionIndex}.`);
    next.nodes[node.id] = node;
    nextParent.children.splice(insertionIndex, 0, node.id);
    return withValidation(next, new DeleteSubtreeCommand(node.id));
  }
}

interface SubtreeSnapshot {
  rootId: string;
  parentId: string;
  index: number;
  nodes: Record<string, UINode>;
}

function snapshotSubtree(project: Project, rootId: string): SubtreeSnapshot {
  const root = project.nodes[rootId];
  if (!root) throw new CommandExecutionError(`Node ${rootId} does not exist.`);
  if (root.parentId === null) throw new CommandExecutionError(`Root node ${rootId} cannot be deleted.`);
  const parent = project.nodes[root.parentId];
  if (!parent) throw new CommandExecutionError(`Parent node ${root.parentId} does not exist.`);
  const index = parent.children.indexOf(rootId);
  if (index < 0) throw new CommandExecutionError(`Parent ${parent.id} does not reference node ${rootId}.`);
  const nodes: Record<string, UINode> = {};
  const visit = (id: string) => {
    const node = project.nodes[id];
    if (!node) throw new CommandExecutionError(`Subtree references missing node ${id}.`);
    nodes[id] = clone(node);
    node.children.forEach(visit);
  };
  visit(rootId);
  return { rootId, parentId: root.parentId, index, nodes };
}

class RestoreSubtreeCommand implements Command {
  readonly type = "restoreSubtree";
  constructor(private readonly snapshot: SubtreeSnapshot) {}
  execute(project: Project): CommandResult {
    const parent = project.nodes[this.snapshot.parentId];
    if (!parent) throw new CommandExecutionError(`Parent node ${this.snapshot.parentId} does not exist.`);
    for (const id of Object.keys(this.snapshot.nodes)) {
      if (project.nodes[id]) throw new CommandExecutionError(`Cannot restore subtree because node ${id} already exists.`);
    }
    const next = clone(project);
    for (const [id, node] of Object.entries(this.snapshot.nodes)) next.nodes[id] = clone(node);
    next.nodes[this.snapshot.parentId]!.children.splice(this.snapshot.index, 0, this.snapshot.rootId);
    return withValidation(next, new DeleteSubtreeCommand(this.snapshot.rootId));
  }
}

export class DeleteSubtreeCommand implements Command {
  readonly type = "deleteSubtree";
  constructor(private readonly nodeId: string) {}
  execute(project: Project): CommandResult {
    const snapshot = snapshotSubtree(project, this.nodeId);
    const next = clone(project);
    next.nodes[snapshot.parentId]!.children.splice(snapshot.index, 1);
    for (const id of Object.keys(snapshot.nodes)) delete next.nodes[id];
    return withValidation(next, new RestoreSubtreeCommand(snapshot));
  }
}

export class DeleteNodeCommand implements Command {
  readonly type = "deleteNode";
  constructor(private readonly nodeId: string) {}
  execute(project: Project): CommandResult {
    return new DeleteSubtreeCommand(this.nodeId).execute(project);
  }
}

export class UpdateNodeCommand implements Command {
  readonly type = "updateNode";
  constructor(private readonly nodeId: string, private readonly changes: Partial<Pick<UINode, "name" | "props" | "style" | "responsive" | "states" | "visible" | "locked" | "componentOverrides">>) {}
  execute(project: Project): CommandResult {
    const node = project.nodes[this.nodeId];
    if (!node) throw new CommandExecutionError(`Node ${this.nodeId} does not exist.`);
    const previous: Partial<Pick<UINode, "name" | "props" | "style" | "responsive" | "states" | "visible" | "locked" | "componentOverrides">> = {};
    for (const key of Object.keys(this.changes) as Array<keyof typeof this.changes>) {
      (previous as Record<string, unknown>)[key] = clone(node[key]);
    }
    const next = clone(project);
    Object.assign(next.nodes[this.nodeId]!, clone(this.changes));
    return withValidation(next, new UpdateNodeCommand(this.nodeId, previous));
  }
}

export class MoveNodeCommand implements Command {
  readonly type = "moveNode";
  constructor(private readonly nodeId: string, private readonly targetParentId: string, private readonly targetIndex?: number) {}
  execute(project: Project): CommandResult {
    const node = project.nodes[this.nodeId];
    if (!node) throw new CommandExecutionError(`Node ${this.nodeId} does not exist.`);
    if (node.parentId === null) throw new CommandExecutionError("Root nodes cannot be moved.");
    const sourceParent = project.nodes[node.parentId];
    const targetParent = project.nodes[this.targetParentId];
    if (!sourceParent) throw new CommandExecutionError(`Source parent ${node.parentId} does not exist.`);
    if (!targetParent) throw new CommandExecutionError(`Target parent ${this.targetParentId} does not exist.`);
    let cursor: string | null = this.targetParentId;
    while (cursor !== null) {
      if (cursor === this.nodeId) throw new CommandExecutionError("Cannot move a node into itself or its descendant.");
      cursor = project.nodes[cursor]?.parentId ?? null;
    }
    const sourceIndex = sourceParent.children.indexOf(this.nodeId);
    if (sourceIndex < 0) throw new CommandExecutionError(`Source parent ${sourceParent.id} does not reference ${this.nodeId}.`);
    const next = clone(project);
    next.nodes[sourceParent.id]!.children.splice(sourceIndex, 1);
    const nextTarget = next.nodes[this.targetParentId]!;
    let index = this.targetIndex ?? nextTarget.children.length;
    if (sourceParent.id === nextTarget.id && index > sourceIndex) index -= 1;
    if (index < 0 || index > nextTarget.children.length) throw new CommandExecutionError(`Invalid target index ${index}.`);
    nextTarget.children.splice(index, 0, this.nodeId);
    next.nodes[this.nodeId]!.parentId = this.targetParentId;
    return withValidation(next, new MoveNodeCommand(this.nodeId, sourceParent.id, sourceIndex));
  }
}

export class DuplicateSubtreeCommand implements Command {
  readonly type = "duplicateSubtree";
  private prepared: SubtreeSnapshot | null = null;

  constructor(private readonly nodeId: string) {}

  execute(project: Project): CommandResult {
    if (this.prepared) {
      return new RestoreSubtreeCommand(this.prepared).execute(project);
    }

    const source = project.nodes[this.nodeId];
    if (!source) throw new CommandExecutionError(`Node ${this.nodeId} does not exist.`);
    if (source.parentId === null) throw new CommandExecutionError("Page root nodes cannot be duplicated.");
    const parent = project.nodes[source.parentId];
    if (!parent) throw new CommandExecutionError(`Parent node ${source.parentId} does not exist.`);
    const sourceIndex = parent.children.indexOf(source.id);
    if (sourceIndex < 0) throw new CommandExecutionError(`Parent ${parent.id} does not reference ${source.id}.`);

    const idMap = new Map<string, string>();
    const allocate = (id: string) => {
      const node = project.nodes[id];
      if (!node) throw new CommandExecutionError(`Subtree references missing node ${id}.`);
      idMap.set(id, createId("node"));
      node.children.forEach(allocate);
    };
    allocate(source.id);

    const duplicatedNodes: Record<string, UINode> = {};
    for (const [oldId, newId] of idMap) {
      const original = project.nodes[oldId]!;
      duplicatedNodes[newId] = {
        ...clone(original),
        id: newId,
        name: oldId === source.id ? `${original.name} Copy` : original.name,
        parentId: original.parentId === source.parentId ? source.parentId : (original.parentId ? idMap.get(original.parentId) ?? null : null),
        children: original.children.map(childId => idMap.get(childId)!)
      };
    }

    const duplicatedRootId = idMap.get(source.id)!;
    this.prepared = {
      rootId: duplicatedRootId,
      parentId: source.parentId,
      index: sourceIndex + 1,
      nodes: duplicatedNodes
    };
    return new RestoreSubtreeCommand(this.prepared).execute(project);
  }
}

export class CreatePageCommand implements Command {
  readonly type = "createPage";
  constructor(private readonly page: Page, private readonly rootNode: UINode) {}
  execute(project: Project): CommandResult {
    if (project.pages[this.page.id]) throw new CommandExecutionError(`Page ${this.page.id} already exists.`);
    if (project.nodes[this.rootNode.id]) throw new CommandExecutionError(`Node ${this.rootNode.id} already exists.`);
    if (Object.values(project.pages).some(page => page.path === this.page.path)) throw new CommandExecutionError(`Page path ${this.page.path} already exists.`);
    if (this.page.rootNodeId !== this.rootNode.id) throw new CommandExecutionError("Page rootNodeId must match provided root node.");
    if (this.rootNode.parentId !== null) throw new CommandExecutionError("Page root node must not have a parent.");
    const next = clone(project);
    next.pages[this.page.id] = clone(this.page);
    next.nodes[this.rootNode.id] = clone(this.rootNode);
    return withValidation(next, new DeletePageCommand(this.page.id));
  }
}

export class DeletePageCommand implements Command {
  readonly type = "deletePage";
  constructor(private readonly pageId: string) {}
  execute(project: Project): CommandResult {
    const page = project.pages[this.pageId];
    if (!page) throw new CommandExecutionError(`Page ${this.pageId} does not exist.`);
    if (project.rootPageId === this.pageId) throw new CommandExecutionError("Root page cannot be deleted.");
    const rootNode = project.nodes[page.rootNodeId];
    if (!rootNode) throw new CommandExecutionError(`Page root node ${page.rootNodeId} does not exist.`);
    if (rootNode.children.length > 0) throw new CommandExecutionError("Only empty pages can be deleted.");
    const next = clone(project);
    delete next.pages[this.pageId];
    delete next.nodes[rootNode.id];
    return withValidation(next, new CreatePageCommand(clone(page), clone(rootNode)));
  }
}

const DESIGN_TOKEN_CATEGORIES = new Set<DesignToken["category"]>([
  "color", "spacing", "radius", "typography", "shadow", "border", "opacity", "breakpoint", "zIndex", "motion"
]);

interface DesignTokenSnapshot {
  token: DesignToken;
  themeOverrides: Record<string, string | number | boolean | null>;
}

class RestoreDesignTokenCommand implements Command {
  readonly type = "restoreDesignToken";
  constructor(private readonly snapshot: DesignTokenSnapshot) {}
  execute(project: Project): CommandResult {
    if (project.tokens[this.snapshot.token.id]) throw new CommandExecutionError(`Token ${this.snapshot.token.id} already exists.`);
    const next = clone(project);
    next.tokens[this.snapshot.token.id] = clone(this.snapshot.token);
    for (const [themeId, value] of Object.entries(this.snapshot.themeOverrides)) {
      const theme = next.themes[themeId];
      if (theme) theme.tokenOverrides[this.snapshot.token.id] = value;
    }
    return withValidation(next, new DeleteDesignTokenCommand(this.snapshot.token.id));
  }
}

export class UpsertDesignTokenCommand implements Command {
  readonly type = "upsertDesignToken";
  constructor(private readonly token: DesignToken) {}
  execute(project: Project): CommandResult {
    if (!this.token.id.trim()) throw new CommandExecutionError("Token id is required.");
    if (!DESIGN_TOKEN_CATEGORIES.has(this.token.category)) throw new CommandExecutionError(`Unsupported token category ${String(this.token.category)}.`);
    const previous = project.tokens[this.token.id];
    const next = clone(project);
    next.tokens[this.token.id] = clone(this.token);
    return withValidation(next, previous ? new UpsertDesignTokenCommand(clone(previous)) : new DeleteDesignTokenCommand(this.token.id));
  }
}

export class DeleteDesignTokenCommand implements Command {
  readonly type = "deleteDesignToken";
  constructor(private readonly tokenId: string) {}
  execute(project: Project): CommandResult {
    const token = project.tokens[this.tokenId];
    if (!token) throw new CommandExecutionError(`Token ${this.tokenId} does not exist.`);
    for (const node of Object.values(project.nodes)) {
      const values = [
        ...Object.values(node.style),
        ...Object.values(node.responsive).flatMap(value => Object.values(value)),
        ...Object.values(node.states).flatMap(value => Object.values(value)),
        ...Object.values(node.componentOverrides?.style ?? {}),
        ...Object.values(node.componentOverrides?.responsive ?? {}).flatMap(value => Object.values(value))
      ];
      if (values.some(value => value && typeof value === "object" && "kind" in value && value.kind === "token" && value.tokenId === this.tokenId)) {
        throw new CommandExecutionError(`Token ${this.tokenId} is still referenced by node ${node.id}.`);
      }
    }
    const themeOverrides: DesignTokenSnapshot["themeOverrides"] = {};
    for (const [themeId, theme] of Object.entries(project.themes)) {
      if (Object.prototype.hasOwnProperty.call(theme.tokenOverrides, this.tokenId)) themeOverrides[themeId] = theme.tokenOverrides[this.tokenId]!;
    }
    const next = clone(project);
    delete next.tokens[this.tokenId];
    for (const theme of Object.values(next.themes)) delete theme.tokenOverrides[this.tokenId];
    return withValidation(next, new RestoreDesignTokenCommand({ token: clone(token), themeOverrides }));
  }
}

export class UpsertThemeCommand implements Command {
  readonly type = "upsertTheme";
  constructor(private readonly theme: Theme) {}
  execute(project: Project): CommandResult {
    if (!this.theme.id.trim()) throw new CommandExecutionError("Theme id is required.");
    const previous = project.themes[this.theme.id];
    const next = clone(project);
    next.themes[this.theme.id] = clone(this.theme);
    return withValidation(next, previous ? new UpsertThemeCommand(clone(previous)) : new DeleteThemeCommand(this.theme.id));
  }
}

export class DeleteThemeCommand implements Command {
  readonly type = "deleteTheme";
  constructor(private readonly themeId: string) {}
  execute(project: Project): CommandResult {
    const theme = project.themes[this.themeId];
    if (!theme) throw new CommandExecutionError(`Theme ${this.themeId} does not exist.`);
    if (project.settings.activeThemeId === this.themeId) throw new CommandExecutionError("The active theme cannot be deleted.");
    const next = clone(project);
    delete next.themes[this.themeId];
    return withValidation(next, new UpsertThemeCommand(clone(theme)));
  }
}

export class SetActiveThemeCommand implements Command {
  readonly type = "setActiveTheme";
  constructor(private readonly themeId: string | null) {}
  execute(project: Project): CommandResult {
    if (this.themeId !== null && !project.themes[this.themeId]) throw new CommandExecutionError(`Theme ${this.themeId} does not exist.`);
    const previous = project.settings.activeThemeId;
    const next = clone(project);
    next.settings.activeThemeId = this.themeId;
    return withValidation(next, new SetActiveThemeCommand(previous));
  }
}

export class UpdateBreakpointCommand implements Command {
  readonly type = "updateBreakpoint";
  constructor(private readonly breakpointId: string, private readonly value: number) {}
  execute(project: Project): CommandResult {
    if (!this.breakpointId.trim()) throw new CommandExecutionError("Breakpoint id is required.");
    if (!Number.isFinite(this.value) || this.value <= 0) throw new CommandExecutionError("Breakpoint value must be a positive number.");
    const previous = project.settings.breakpoints[this.breakpointId];
    const next = clone(project);
    next.settings.breakpoints[this.breakpointId] = this.value;
    const inverse: Command = previous === undefined ? new DeleteBreakpointCommand(this.breakpointId) : new UpdateBreakpointCommand(this.breakpointId, previous);
    return withValidation(next, inverse);
  }
}

export class DeleteBreakpointCommand implements Command {
  readonly type = "deleteBreakpoint";
  constructor(private readonly breakpointId: string) {}
  execute(project: Project): CommandResult {
    const previous = project.settings.breakpoints[this.breakpointId];
    if (previous === undefined) throw new CommandExecutionError(`Breakpoint ${this.breakpointId} does not exist.`);
    for (const node of Object.values(project.nodes)) {
      if (node.responsive[this.breakpointId] || node.componentOverrides?.responsive?.[this.breakpointId]) {
        throw new CommandExecutionError(`Breakpoint ${this.breakpointId} is still referenced by node ${node.id}.`);
      }
    }
    const next = clone(project);
    delete next.settings.breakpoints[this.breakpointId];
    return withValidation(next, new UpdateBreakpointCommand(this.breakpointId, previous));
  }
}

interface ComponentSnapshot {
  definition: ComponentDefinition;
  nodes: Record<string, UINode>;
}

class RestoreComponentDefinitionCommand implements Command {
  readonly type = "restoreComponentDefinition";
  constructor(private readonly snapshot: ComponentSnapshot) {}
  execute(project: Project): CommandResult {
    if (project.components[this.snapshot.definition.id]) throw new CommandExecutionError(`Component ${this.snapshot.definition.id} already exists.`);
    const next = clone(project);
    for (const [id, node] of Object.entries(this.snapshot.nodes)) {
      if (next.nodes[id]) throw new CommandExecutionError(`Component node ${id} already exists.`);
      next.nodes[id] = clone(node);
    }
    next.components[this.snapshot.definition.id] = clone(this.snapshot.definition);
    return withValidation(next, new DeleteComponentDefinitionCommand(this.snapshot.definition.id));
  }
}

export class CreateReusableComponentCommand implements Command {
  readonly type = "createReusableComponent";
  private prepared: ComponentSnapshot | null = null;
  constructor(private readonly sourceNodeId: string, private readonly name?: string) {}
  execute(project: Project): CommandResult {
    if (this.prepared) return new RestoreComponentDefinitionCommand(this.prepared).execute(project);
    const source = project.nodes[this.sourceNodeId];
    if (!source) throw new CommandExecutionError(`Node ${this.sourceNodeId} does not exist.`);
    const idMap = new Map<string, string>();
    const allocate = (id: string) => {
      const node = project.nodes[id];
      if (!node) throw new CommandExecutionError(`Subtree references missing node ${id}.`);
      idMap.set(id, createId("node"));
      node.children.forEach(allocate);
    };
    allocate(source.id);
    const nodes: Record<string, UINode> = {};
    for (const [oldId, newId] of idMap) {
      const original = project.nodes[oldId]!;
      const copied = clone(original);
      copied.id = newId;
      copied.parentId = oldId === source.id ? null : (original.parentId ? idMap.get(original.parentId) ?? null : null);
      copied.children = original.children.map(childId => idMap.get(childId)!);
      delete copied.componentRef;
      delete copied.componentOverrides;
      nodes[newId] = copied;
    }
    const componentId = createId("component");
    this.prepared = {
      definition: { id: componentId, name: this.name?.trim() || source.name, rootNodeId: idMap.get(source.id)!, props: {} },
      nodes
    };
    return new RestoreComponentDefinitionCommand(this.prepared).execute(project);
  }
}

export class DeleteComponentDefinitionCommand implements Command {
  readonly type = "deleteComponentDefinition";
  constructor(private readonly componentId: string) {}
  execute(project: Project): CommandResult {
    const definition = project.components[this.componentId];
    if (!definition) throw new CommandExecutionError(`Component ${this.componentId} does not exist.`);
    const instance = Object.values(project.nodes).find(node => node.componentRef === this.componentId);
    if (instance) throw new CommandExecutionError(`Component ${this.componentId} is still used by node ${instance.id}.`);
    const nodes: Record<string, UINode> = {};
    const visit = (id: string) => {
      const node = project.nodes[id];
      if (!node) throw new CommandExecutionError(`Component references missing node ${id}.`);
      nodes[id] = clone(node);
      node.children.forEach(visit);
    };
    visit(definition.rootNodeId);
    const next = clone(project);
    delete next.components[this.componentId];
    for (const id of Object.keys(nodes)) delete next.nodes[id];
    return withValidation(next, new RestoreComponentDefinitionCommand({ definition: clone(definition), nodes }));
  }
}
