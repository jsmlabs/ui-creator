import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createProject } from "../dist/packages/schema/src/index.js";
import { serializeProject } from "../dist/packages/serialization/src/index.js";
import {
  projectFile,
  ProjectRepository,
  RecentProjectsStore
} from "../dist/packages/persistence/src/index.js";
import { createLocalServer } from "../apps/server/src/server.mjs";

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ui-creator-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("repository create/save/load/list/delete round-trip", async () => {
  await withTempDir(async root => {
    const repository = new ProjectRepository(root);
    await repository.initialize();

    const project = createProject("Persistence", new Date("2026-10-02T00:00:00.000Z"));
    await repository.create(project);
    assert.equal(await repository.exists(project.id), true);

    project.name = "Persistence Updated";
    project.metadata.updatedAt = "2026-10-02T01:00:00.000Z";
    await repository.save(project);

    const loaded = await repository.load(project.id);
    assert.equal(loaded.recoveredFromBackup, false);
    assert.equal(serializeProject(loaded.project), serializeProject(project));

    const list = await repository.list();
    assert.deepEqual(list, [{ id: project.id, name: project.name, updatedAt: project.metadata.updatedAt }]);

    await repository.delete(project.id);
    assert.equal(await repository.exists(project.id), false);
  });
});

test("save creates backups and recovery loads newest valid backup without overwriting corruption", async () => {
  await withTempDir(async root => {
    const repository = new ProjectRepository(root, { maxBackups: 3 });
    const project = createProject("Recovery", new Date("2026-10-02T00:00:00.000Z"));
    await repository.create(project);

    project.name = "Recovery v2";
    project.metadata.updatedAt = "2026-10-02T00:01:00.000Z";
    await repository.save(project);

    const backups = await repository.listBackups(project.id);
    assert.equal(backups.length, 1);

    const mainPath = projectFile(root, project.id);
    await writeFile(mainPath, "{broken-json", "utf8");

    const loaded = await repository.load(project.id);
    assert.equal(loaded.recoveredFromBackup, true);
    assert.equal(loaded.project.name, "Recovery");
    assert.equal(await readFile(mainPath, "utf8"), "{broken-json");
  });
});

test("backup rotation keeps configured maximum", async () => {
  await withTempDir(async root => {
    const repository = new ProjectRepository(root, { maxBackups: 2 });
    const project = createProject("Rotation");
    await repository.create(project);
    for (let index = 1; index <= 4; index += 1) {
      project.name = `Rotation ${index}`;
      project.metadata.updatedAt = new Date(Date.now() + index).toISOString();
      await repository.save(project);
    }
    assert.equal((await repository.listBackups(project.id)).length, 2);
  });
});

test("recent projects store persists and orders by last opened time", async () => {
  await withTempDir(async root => {
    const store = new RecentProjectsStore(root);
    await store.initialize();
    const a = createProject("A");
    const b = createProject("B");
    store.record(a, "/a", new Date("2026-10-02T01:00:00.000Z"));
    store.record(b, "/b", new Date("2026-10-02T02:00:00.000Z"));
    assert.deepEqual(store.list().map(item => item.projectId), [b.id, a.id]);
    store.remove(b.id);
    assert.deepEqual(store.list().map(item => item.projectId), [a.id]);
    store.close();
  });
});

test("HTTP API supports health and project CRUD", async () => {
  await withTempDir(async root => {
    const repository = new ProjectRepository(root);
    const recentProjects = new RecentProjectsStore(root);
    await repository.initialize();
    await recentProjects.initialize();
    const server = createLocalServer({ repository, recentProjects });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}/api/v1`;

    try {
      let response = await fetch(`${base}/health`);
      assert.equal(response.status, 200);
      const health = (await response.json()).data;
      assert.equal(health.ready, true);
      assert.equal(health.version, "0.7.0");

      response = await fetch(`${base}/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "API Project" })
      });
      assert.equal(response.status, 201);
      const created = (await response.json()).data;

      response = await fetch(`${base}/projects/${created.id}`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.project.name, "API Project");

      response = await fetch(`${base}/projects/${created.id}/export`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/zip");
      assert.match(response.headers.get("content-disposition") ?? "", /API-Project|api-project/i);
      const archive = Buffer.from(await response.arrayBuffer());
      assert.equal(archive.readUInt32LE(0), 0x04034b50);

      created.name = "API Updated";
      response = await fetch(`${base}/projects/${created.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(created)
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.name, "API Updated");

      response = await fetch(`${base}/recent-projects`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data[0].projectId, created.id);

      response = await fetch(`${base}/projects/${created.id}`, { method: "DELETE" });
      assert.equal(response.status, 204);

      response = await fetch(`${base}/projects/${created.id}`);
      assert.equal(response.status, 404);
    } finally {
      await new Promise(resolve => server.close(resolve));
      recentProjects.close();
    }
  });
});
