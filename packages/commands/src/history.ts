import type { Project } from "../../schema/src/index.js";
import { validateProjectOrThrow } from "../../validation/src/index.js";
import type { Command } from "./types.js";

interface HistoryEntry { forward: Command; inverse: Command; }

export class CommandHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  execute(project: Project, command: Command): Project {
    const result = command.execute(project);
    validateProjectOrThrow(result.project);
    this.undoStack.push({ forward: command, inverse: result.inverse });
    this.redoStack = [];
    return result.project;
  }

  undo(project: Project): Project {
    const entry = this.undoStack.pop();
    if (!entry) return project;
    const result = entry.inverse.execute(project);
    validateProjectOrThrow(result.project);
    this.redoStack.push({ forward: entry.forward, inverse: result.inverse });
    return result.project;
  }

  redo(project: Project): Project {
    const entry = this.redoStack.pop();
    if (!entry) return project;
    const result = entry.forward.execute(project);
    validateProjectOrThrow(result.project);
    this.undoStack.push({ forward: entry.forward, inverse: result.inverse });
    return result.project;
  }

  clear(): void { this.undoStack = []; this.redoStack = []; }
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}
