import http from "node:http";
import { URL } from "node:url";
import { createProject } from "../../../dist/packages/schema/src/index.js";
import { projectDirectory } from "../../../dist/packages/persistence/src/index.js";

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  res.end(body);
}

function errorPayload(code, message, details) {
  return {
    ok: false,
    error: { code, message, ...(details === undefined ? {} : { details }) }
  };
}

async function readJson(req, maxBytes = 2 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error("Request body too large."), { statusCode: 413, errorCode: "BODY_TOO_LARGE" });
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON body."), { statusCode: 400, errorCode: "INVALID_JSON" });
  }
}

export function createLocalServer({ repository, recentProjects }) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const method = req.method ?? "GET";
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

      if (method === "GET" && url.pathname === "/api/v1/health") {
        return json(res, 200, { ok: true, data: { ready: true, version: "0.5.0" } });
      }

      if (method === "GET" && url.pathname === "/api/v1/projects") {
        return json(res, 200, { ok: true, data: await repository.list() });
      }

      if (method === "GET" && url.pathname === "/api/v1/recent-projects") {
        return json(res, 200, { ok: true, data: recentProjects.list() });
      }

      if (method === "POST" && url.pathname === "/api/v1/projects") {
        const body = await readJson(req);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) return json(res, 400, errorPayload("PROJECT_NAME_REQUIRED", "Project name is required."));
        const project = createProject(name);
        await repository.create(project);
        recentProjects.record(project, projectDirectory(repository.rootDir, project.id));
        return json(res, 201, { ok: true, data: project });
      }

      if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "projects" && typeof parts[3] === "string") {
        const projectId = parts[3];

        if (parts.length === 4 && method === "GET") {
          const loaded = await repository.load(projectId);
          recentProjects.record(loaded.project, projectDirectory(repository.rootDir, loaded.project.id));
          return json(res, 200, { ok: true, data: loaded });
        }

        if (parts.length === 4 && method === "PUT") {
          const project = await readJson(req);
          if (!project || project.id !== projectId) {
            return json(res, 400, errorPayload("PROJECT_ID_MISMATCH", "Request path id must match project id."));
          }
          project.metadata.updatedAt = new Date().toISOString();
          await repository.save(project);
          recentProjects.record(project, projectDirectory(repository.rootDir, project.id));
          return json(res, 200, { ok: true, data: project });
        }

        if (parts.length === 4 && method === "DELETE") {
          await repository.delete(projectId);
          recentProjects.remove(projectId);
          res.writeHead(204);
          return res.end();
        }

        if (parts.length === 5 && parts[4] === "backups" && method === "GET") {
          return json(res, 200, { ok: true, data: await repository.listBackups(projectId) });
        }

        if (parts.length === 5 && parts[4] === "backups" && method === "POST") {
          return json(res, 201, { ok: true, data: await repository.createBackup(projectId) });
        }

        if (parts.length === 7 && parts[4] === "backups" && parts[6] === "restore" && method === "POST") {
          const project = await repository.restoreBackup(projectId, parts[5]);
          recentProjects.record(project, projectDirectory(repository.rootDir, project.id));
          return json(res, 200, { ok: true, data: project });
        }
      }

      return json(res, 404, errorPayload("NOT_FOUND", "Route not found."));
    } catch (error) {
      const status = error?.statusCode ?? (error?.code === "ENOENT" ? 404 : 500);
      const code = error?.errorCode ?? (status === 404 ? "PROJECT_NOT_FOUND" : "INTERNAL_ERROR");
      return json(res, status, errorPayload(code, error instanceof Error ? error.message : "Unknown server error."));
    }
  });
}
