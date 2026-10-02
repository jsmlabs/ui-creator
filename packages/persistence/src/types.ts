import type { Project } from "../../schema/src/index.js";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface LoadedProject {
  project: Project;
  recoveredFromBackup: boolean;
  recoveryBackupPath?: string;
}

export interface BackupInfo {
  name: string;
  path: string;
  createdAt: string;
}
