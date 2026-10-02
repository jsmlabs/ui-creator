import { mkdir, readFile, readdir, rename, rm, stat, open, unlink, copyFile } from "node:fs/promises";
import path from "node:path";
import type { Project } from "../../schema/src/index.js";
import { deserializeProject, serializeProject } from "../../serialization/src/index.js";
import { backupDirectory, projectDirectory, projectFile } from "./paths.js";
import type { BackupInfo, LoadedProject, ProjectSummary } from "./types.js";

export interface ProjectRepositoryOptions {
  maxBackups?: number;
}

export class ProjectRepository {
  private readonly maxBackups: number;

  constructor(
    readonly rootDir: string,
    options: ProjectRepositoryOptions = {}
  ) {
    this.maxBackups = options.maxBackups ?? 10;
    if (!Number.isInteger(this.maxBackups) || this.maxBackups < 1) {
      throw new Error("maxBackups must be an integer >= 1.");
    }
  }

  async initialize(): Promise<void> {
    await mkdir(path.join(this.rootDir, "projects"), { recursive: true });
  }

  async exists(projectId: string): Promise<boolean> {
    try {
      await stat(projectFile(this.rootDir, projectId));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  async create(project: Project): Promise<void> {
    if (await this.exists(project.id)) {
      throw new Error(`Project ${project.id} already exists.`);
    }
    await this.save(project, { createBackup: false });
  }

  async save(project: Project, options: { createBackup?: boolean } = {}): Promise<void> {
    const dir = projectDirectory(this.rootDir, project.id);
    const file = projectFile(this.rootDir, project.id);
    const temp = `${file}.tmp`;
    const serialized = serializeProject(project);

    await mkdir(dir, { recursive: true });

    if ((options.createBackup ?? true) && await this.exists(project.id)) {
      await this.createBackup(project.id);
    }

    try {
      const handle = await open(temp, "w");
      try {
        await handle.writeFile(serialized, { encoding: "utf8" });
        await handle.sync();
      } finally {
        await handle.close();
      }

      const check = await readFile(temp, "utf8");
      deserializeProject(check);

      try {
        await rename(temp, file);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EEXIST" && code !== "EPERM") throw error;
        await unlink(file);
        await rename(temp, file);
      }
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  async load(projectId: string): Promise<LoadedProject> {
    const file = projectFile(this.rootDir, projectId);

    try {
      const raw = await readFile(file, "utf8");
      return { project: deserializeProject(raw), recoveredFromBackup: false };
    } catch (primaryError) {
      const backups = await this.listBackups(projectId);
      for (const backup of backups) {
        try {
          const raw = await readFile(backup.path, "utf8");
          return {
            project: deserializeProject(raw),
            recoveredFromBackup: true,
            recoveryBackupPath: backup.path
          };
        } catch {
          // Continue to older backup.
        }
      }
      throw primaryError;
    }
  }

  async list(): Promise<ProjectSummary[]> {
    await this.initialize();
    const entries = await readdir(path.join(this.rootDir, "projects"), { withFileTypes: true });
    const summaries: ProjectSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const loaded = await this.load(entry.name);
        summaries.push({
          id: loaded.project.id,
          name: loaded.project.name,
          updatedAt: loaded.project.metadata.updatedAt
        });
      } catch {
        // Corrupt/unreadable project directories are intentionally omitted from normal listing.
      }
    }

    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async delete(projectId: string): Promise<void> {
    await rm(projectDirectory(this.rootDir, projectId), { recursive: true, force: true });
  }

  async createBackup(projectId: string): Promise<BackupInfo> {
    const source = projectFile(this.rootDir, projectId);
    const backups = backupDirectory(this.rootDir, projectId);
    await mkdir(backups, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let name = `${timestamp}.json`;
    let destination = path.join(backups, name);
    let suffix = 1;

    while (true) {
      try {
        await stat(destination);
        name = `${timestamp}-${suffix}.json`;
        destination = path.join(backups, name);
        suffix += 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
        throw error;
      }
    }

    await copyFile(source, destination);
    await this.pruneBackups(projectId);

    return { name, path: destination, createdAt: new Date().toISOString() };
  }

  async listBackups(projectId: string): Promise<BackupInfo[]> {
    const dir = backupDirectory(this.rootDir, projectId);
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const backups: BackupInfo[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const fullPath = path.join(dir, entry.name);
        const info = await stat(fullPath);
        backups.push({ name: entry.name, path: fullPath, createdAt: info.mtime.toISOString() });
      }
      return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async restoreBackup(projectId: string, backupName: string): Promise<Project> {
    if (!/^[A-Za-z0-9._-]+\.json$/.test(backupName)) {
      throw new Error("Invalid backup name.");
    }
    const backupPath = path.join(backupDirectory(this.rootDir, projectId), backupName);
    const raw = await readFile(backupPath, "utf8");
    const project = deserializeProject(raw);
    if (project.id !== projectId) {
      throw new Error("Backup project id mismatch.");
    }
    await this.save(project, { createBackup: true });
    return project;
  }

  private async pruneBackups(projectId: string): Promise<void> {
    const backups = await this.listBackups(projectId);
    for (const backup of backups.slice(this.maxBackups)) {
      await rm(backup.path, { force: true });
    }
  }
}
