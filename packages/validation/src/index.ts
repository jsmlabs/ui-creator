import { CURRENT_SCHEMA_VERSION, type Project, type TokenOrValue, type UINode } from "../../schema/src/types.js";

export type ValidationSeverity = "error" | "warning" | "info";
export interface ValidationIssue { code: string; severity: ValidationSeverity; message: string; path?: string; }
export interface ValidationResult { valid: boolean; issues: ValidationIssue[]; }

export class ProjectValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super("Project validation failed.");
    this.name = "ProjectValidationError";
    this.issues = issues;
  }
}

function error(code: string, message: string, path?: string): ValidationIssue {
  return path === undefined ? { code, severity: "error", message } : { code, severity: "error", message, path };
}

function tokenReferencesFromValue(value: unknown): string[] {
  if (value === null || typeof value !== "object") return [];
  const candidate = value as Partial<TokenOrValue>;
  return candidate.kind === "token" && typeof (candidate as { tokenId?: unknown }).tokenId === "string"
    ? [(candidate as { tokenId: string }).tokenId]
    : [];
}

function validateNodeReferences(project: Project, node: UINode, issues: ValidationIssue[]): void {
  if (node.parentId !== null && !project.nodes[node.parentId]) {
    issues.push(error("BROKEN_PARENT_REFERENCE", `Node ${node.id} references missing parent ${node.parentId}.`, `nodes.${node.id}.parentId`));
  }
  const seenChildren = new Set<string>();
  for (const childId of node.children) {
    if (seenChildren.has(childId)) {
      issues.push(error("DUPLICATE_CHILD_REFERENCE", `Node ${node.id} contains child ${childId} more than once.`, `nodes.${node.id}.children`));
      continue;
    }
    seenChildren.add(childId);
    const child = project.nodes[childId];
    if (!child) {
      issues.push(error("BROKEN_CHILD_REFERENCE", `Node ${node.id} references missing child ${childId}.`, `nodes.${node.id}.children`));
      continue;
    }
    if (child.parentId !== node.id) {
      issues.push(error("PARENT_CHILD_MISMATCH", `Child ${childId} does not point back to parent ${node.id}.`, `nodes.${childId}.parentId`));
    }
  }
  const styleValues: unknown[] = Object.values(node.style);
  for (const responsive of Object.values(node.responsive)) styleValues.push(...Object.values(responsive));
  for (const state of Object.values(node.states)) styleValues.push(...Object.values(state));
  styleValues.push(...Object.values(node.componentOverrides?.style ?? {}));
  for (const responsive of Object.values(node.componentOverrides?.responsive ?? {})) styleValues.push(...Object.values(responsive));
  for (const tokenId of styleValues.flatMap(tokenReferencesFromValue)) {
    if (!project.tokens[tokenId]) issues.push(error("TOKEN_NOT_FOUND", `Node ${node.id} references missing token ${tokenId}.`, `nodes.${node.id}`));
  }
  for (const breakpointId of [...Object.keys(node.responsive), ...Object.keys(node.componentOverrides?.responsive ?? {})]) {
    if (!(breakpointId in project.settings.breakpoints)) {
      issues.push(error("BREAKPOINT_NOT_FOUND", `Node ${node.id} references missing breakpoint ${breakpointId}.`, `nodes.${node.id}.responsive`));
    }
  }
  if (node.componentRef && !project.components[node.componentRef]) {
    issues.push(error("COMPONENT_NOT_FOUND", `Node ${node.id} references missing component ${node.componentRef}.`, `nodes.${node.id}.componentRef`));
  }
  if (!node.componentRef && node.componentOverrides) {
    issues.push(error("COMPONENT_OVERRIDES_WITHOUT_REFERENCE", `Node ${node.id} has component overrides without a component reference.`, `nodes.${node.id}.componentOverrides`));
  }
}

function validateCycles(project: Project, issues: ValidationIssue[]): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): void => {
    if (visiting.has(nodeId)) {
      issues.push(error("CYCLIC_TREE", `Cycle detected at node ${nodeId}.`, `nodes.${nodeId}`));
      return;
    }
    if (visited.has(nodeId)) return;
    const node = project.nodes[nodeId];
    if (!node) return;
    visiting.add(nodeId);
    for (const childId of node.children) visit(childId);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const nodeId of Object.keys(project.nodes)) visit(nodeId);
}

export function validateProject(project: Project): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (project.schemaVersion !== CURRENT_SCHEMA_VERSION) issues.push(error("UNSUPPORTED_SCHEMA_VERSION", `Expected schema ${CURRENT_SCHEMA_VERSION}, received ${project.schemaVersion}.`, "schemaVersion"));
  if (!project.id) issues.push(error("PROJECT_ID_REQUIRED", "Project id is required.", "id"));
  if (!project.name.trim()) issues.push(error("PROJECT_NAME_REQUIRED", "Project name is required.", "name"));
  if (project.rootPageId !== null && !project.pages[project.rootPageId]) issues.push(error("ROOT_PAGE_NOT_FOUND", `Root page ${project.rootPageId} does not exist.`, "rootPageId"));

  const pagePaths = new Set<string>();
  for (const [pageId, page] of Object.entries(project.pages)) {
    if (page.id !== pageId) issues.push(error("PAGE_KEY_ID_MISMATCH", `Page key ${pageId} does not match page id ${page.id}.`, `pages.${pageId}.id`));
    if (!project.nodes[page.rootNodeId]) issues.push(error("PAGE_ROOT_NOT_FOUND", `Page ${pageId} references missing root node ${page.rootNodeId}.`, `pages.${pageId}.rootNodeId`));
    if (pagePaths.has(page.path)) issues.push(error("DUPLICATE_PAGE_PATH", `Page path ${page.path} is duplicated.`, `pages.${pageId}.path`));
    pagePaths.add(page.path);
  }

  for (const [nodeId, node] of Object.entries(project.nodes)) {
    if (node.id !== nodeId) issues.push(error("NODE_KEY_ID_MISMATCH", `Node key ${nodeId} does not match node id ${node.id}.`, `nodes.${nodeId}.id`));
    validateNodeReferences(project, node, issues);
  }

  for (const interaction of Object.values(project.interactions)) {
    if (!project.nodes[interaction.sourceNodeId]) issues.push(error("INTERACTION_SOURCE_NOT_FOUND", `Interaction ${interaction.id} references missing source node ${interaction.sourceNodeId}.`, `interactions.${interaction.id}.sourceNodeId`));
  }

  for (const [breakpointId, value] of Object.entries(project.settings.breakpoints)) {
    if (!Number.isFinite(value) || value <= 0) issues.push(error("INVALID_BREAKPOINT", `Breakpoint ${breakpointId} must be a positive finite number.`, `settings.breakpoints.${breakpointId}`));
  }

  if (project.settings.activeThemeId !== null && !project.themes[project.settings.activeThemeId]) {
    issues.push(error("ACTIVE_THEME_NOT_FOUND", `Active theme ${project.settings.activeThemeId} does not exist.`, "settings.activeThemeId"));
  }

  for (const [themeId, theme] of Object.entries(project.themes)) {
    if (theme.id !== themeId) issues.push(error("THEME_KEY_ID_MISMATCH", `Theme key ${themeId} does not match theme id ${theme.id}.`, `themes.${themeId}.id`));
    for (const tokenId of Object.keys(theme.tokenOverrides)) {
      if (!project.tokens[tokenId]) issues.push(error("THEME_TOKEN_NOT_FOUND", `Theme ${themeId} overrides missing token ${tokenId}.`, `themes.${themeId}.tokenOverrides.${tokenId}`));
    }
  }

  const validTokenCategories = new Set(["color", "spacing", "radius", "typography", "shadow", "border", "opacity", "breakpoint", "zIndex", "motion"]);
  for (const [tokenId, token] of Object.entries(project.tokens)) {
    if (token.id !== tokenId) issues.push(error("TOKEN_KEY_ID_MISMATCH", `Token key ${tokenId} does not match token id ${token.id}.`, `tokens.${tokenId}.id`));
    if (!validTokenCategories.has(token.category)) issues.push(error("INVALID_TOKEN_CATEGORY", `Token ${tokenId} has unsupported category ${String(token.category)}.`, `tokens.${tokenId}.category`));
  }

  for (const [componentId, component] of Object.entries(project.components)) {
    if (component.id !== componentId) issues.push(error("COMPONENT_KEY_ID_MISMATCH", `Component key ${componentId} does not match component id ${component.id}.`, `components.${componentId}.id`));
    const root = project.nodes[component.rootNodeId];
    if (!root) issues.push(error("COMPONENT_ROOT_NOT_FOUND", `Component ${component.id} references missing root node ${component.rootNodeId}.`, `components.${component.id}.rootNodeId`));
    else if (root.parentId !== null) issues.push(error("COMPONENT_ROOT_HAS_PARENT", `Component ${component.id} root node must be detached from page trees.`, `components.${component.id}.rootNodeId`));
  }

  validateCycles(project, issues);
  return { valid: issues.every(issue => issue.severity !== "error"), issues };
}

export function validateProjectOrThrow(project: Project): void {
  const result = validateProject(project);
  if (!result.valid) throw new ProjectValidationError(result.issues);
}
