import type { Project } from "../../schema/src/index.js";
export interface CommandResult { project: Project; inverse: Command; }
export interface Command { readonly type: string; execute(project: Project): CommandResult; }
export class CommandExecutionError extends Error {
  constructor(message: string) { super(message); this.name = "CommandExecutionError"; }
}
