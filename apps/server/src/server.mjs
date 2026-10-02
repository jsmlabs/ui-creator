import http from "node:http";
import { URL } from "node:url";
import { createProject } from "../../../dist/packages/schema/src/index.js";
import { exportProject } from "../../../dist/packages/exporter/src/index.js";
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


const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipFiles(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const nameBuffer = Buffer.from(name.replace(/\\/g, "/"), "utf8");
    const data = Buffer.from(content, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  const count = Object.keys(files).length;
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function binary(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/octet-stream",
    "content-length": body.length,
    "cache-control": "no-store",
    ...headers
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
        return json(res, 200, { ok: true, data: { ready: true, version: "0.7.0" } });
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

        if (parts.length === 5 && parts[4] === "export" && method === "GET") {
          const loaded = await repository.load(projectId);
          const bundle = exportProject(loaded.project);
          const archive = zipFiles(bundle.files);
          return binary(res, 200, archive, {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${bundle.fileName}"`
          });
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
