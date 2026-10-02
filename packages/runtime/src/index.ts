import type { Interaction, InteractionAction, Project, RuntimeVariable } from "../../schema/src/index.js";

export interface RuntimeState {
  activePageId: string | null;
  variables: Record<string, string | number | boolean>;
  visibility: Record<string, boolean>;
  focusTargetId: string | null;
  scrollTargetId: string | null;
  submittedNodeId: string | null;
}

export function createRuntimeState(project: Project): RuntimeState {
  return {
    activePageId: project.rootPageId,
    variables: Object.fromEntries(Object.values(project.variables).map(variable => [variable.id, variable.initialValue])),
    visibility: {},
    focusTargetId: null,
    scrollTargetId: null,
    submittedNodeId: null
  };
}

export function isNodeRuntimeVisible(project: Project, state: RuntimeState, nodeId: string): boolean {
  return state.visibility[nodeId] ?? project.nodes[nodeId]?.visible ?? false;
}

function coerceVariableValue(variable: RuntimeVariable, value: unknown): string | number | boolean {
  if (variable.type === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : variable.initialValue;
  }
  if (variable.type === "boolean") return typeof value === "boolean" ? value : value === "true";
  return String(value ?? "");
}

export function applyRuntimeAction(project: Project, state: RuntimeState, action: InteractionAction): RuntimeState {
  const next: RuntimeState = structuredClone(state);
  const payload = action.payload;

  switch (action.type) {
    case "navigate": {
      const pageId = typeof payload.pageId === "string" ? payload.pageId : null;
      if (pageId && project.pages[pageId]) next.activePageId = pageId;
      return next;
    }
    case "open":
    case "close":
    case "toggle": {
      const targetNodeId = typeof payload.targetNodeId === "string" ? payload.targetNodeId : null;
      if (!targetNodeId || !project.nodes[targetNodeId]) return next;
      if (action.type === "open") next.visibility[targetNodeId] = true;
      else if (action.type === "close") next.visibility[targetNodeId] = false;
      else next.visibility[targetNodeId] = !isNodeRuntimeVisible(project, state, targetNodeId);
      return next;
    }
    case "setVariable": {
      const variableId = typeof payload.variableId === "string" ? payload.variableId : null;
      const variable = variableId ? project.variables[variableId] : undefined;
      if (variable) next.variables[variable.id] = coerceVariableValue(variable, payload.value);
      return next;
    }
    case "updateVariable": {
      const variableId = typeof payload.variableId === "string" ? payload.variableId : null;
      const variable = variableId ? project.variables[variableId] : undefined;
      if (!variable) return next;
      const current = next.variables[variable.id];
      const operation = payload.operation;
      if (operation === "toggle" && variable.type === "boolean") next.variables[variable.id] = !Boolean(current);
      else if (operation === "increment" && variable.type === "number") next.variables[variable.id] = Number(current) + Number(payload.amount ?? 1);
      else if (operation === "decrement" && variable.type === "number") next.variables[variable.id] = Number(current) - Number(payload.amount ?? 1);
      else next.variables[variable.id] = coerceVariableValue(variable, payload.value);
      return next;
    }
    case "submit":
      next.submittedNodeId = typeof payload.targetNodeId === "string" ? payload.targetNodeId : null;
      return next;
    case "reset":
      return createRuntimeState(project);
    case "focus":
      next.focusTargetId = typeof payload.targetNodeId === "string" ? payload.targetNodeId : null;
      return next;
    case "scrollTo":
      next.scrollTargetId = typeof payload.targetNodeId === "string" ? payload.targetNodeId : null;
      return next;
    default:
      return next;
  }
}

export function executeInteraction(project: Project, state: RuntimeState, interaction: Interaction): RuntimeState {
  return interaction.actions.reduce((current, action) => applyRuntimeAction(project, current, action), state);
}

export function interactionsFor(project: Project, nodeId: string, event: Interaction["event"]): Interaction[] {
  return Object.values(project.interactions)
    .filter(interaction => interaction.sourceNodeId === nodeId && interaction.event === event)
    .sort((a, b) => a.id.localeCompare(b.id));
}
