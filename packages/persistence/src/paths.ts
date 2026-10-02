import path from "node:path";

export function assertSafeProjectId(projectId: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(projectId) || projectId === "." || projectId === "..") {
    throw new Error(`Invalid project id: ${projectId}`);
  }
}

export function projectDirectory(rootDir: string, projectId: string): string {
  assertSafeProjectId(projectId);
  return path.join(rootDir, "projects", projectId);
}

export function projectFile(rootDir: string, projectId: string): string {
  return path.join(projectDirectory(rootDir, projectId), "project.json");
}

export function backupDirectory(rootDir: string, projectId: string): string {
  return path.join(projectDirectory(rootDir, projectId), "backups");
}
