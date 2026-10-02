import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProjectRepository, RecentProjectsStore } from "../../../dist/packages/persistence/src/index.js";
import { createLocalServer } from "./server.mjs";

const host = process.env.UI_CREATOR_HOST ?? "127.0.0.1";
const port = Number(process.env.UI_CREATOR_PORT ?? "4174");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("UI_CREATOR_PORT must be a valid TCP port.");

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.resolve(moduleDir, "../../../data");
const dataDir = path.resolve(process.env.UI_CREATOR_DATA_DIR ?? defaultDataDir);

const repository = new ProjectRepository(dataDir);
const recentProjects = new RecentProjectsStore(dataDir);
await repository.initialize();
await recentProjects.initialize();

const server = createLocalServer({ repository, recentProjects });
server.listen(port, host, () => {
  process.stdout.write(`UI Creator server listening on http://${host}:${port}\nData: ${dataDir}\n`);
});

function shutdown() {
  server.close(() => {
    recentProjects.close();
    process.exit(0);
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
