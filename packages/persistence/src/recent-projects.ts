import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Project } from "../../schema/src/index.js";

export interface RecentProject {
  projectId: string;
  name: string;
  lastOpenedAt: string;
  projectPath: string;
}

export class RecentProjectsStore {
  private database: DatabaseSync | null = null;

  constructor(private readonly rootDir: string) {}

  async initialize(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    const dbPath = path.join(this.rootDir, "app.sqlite");
    this.database = new DatabaseSync(dbPath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS recent_projects (
        project_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        last_opened_at TEXT NOT NULL,
        project_path TEXT NOT NULL
      )
    `);
  }

  record(project: Project, projectPath: string, now = new Date()): void {
    const db = this.requireDatabase();
    db.prepare(`
      INSERT INTO recent_projects (project_id, name, last_opened_at, project_path)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        name = excluded.name,
        last_opened_at = excluded.last_opened_at,
        project_path = excluded.project_path
    `).run(project.id, project.name, now.toISOString(), projectPath);
  }

  list(limit = 20): RecentProject[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("limit must be an integer between 1 and 100.");
    }
    const rows = this.requireDatabase().prepare(`
      SELECT project_id, name, last_opened_at, project_path
      FROM recent_projects
      ORDER BY last_opened_at DESC
      LIMIT ?
    `).all(limit) as Array<{
      project_id: string;
      name: string;
      last_opened_at: string;
      project_path: string;
    }>;

    return rows.map(row => ({
      projectId: row.project_id,
      name: row.name,
      lastOpenedAt: row.last_opened_at,
      projectPath: row.project_path
    }));
  }

  remove(projectId: string): void {
    this.requireDatabase().prepare("DELETE FROM recent_projects WHERE project_id = ?").run(projectId);
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  private requireDatabase(): DatabaseSync {
    if (!this.database) throw new Error("RecentProjectsStore is not initialized.");
    return this.database;
  }
}
