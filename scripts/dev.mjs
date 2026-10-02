import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function spawnNpmScript(script) {
  if (process.platform === "win32") {
    const commandInterpreter = process.env.ComSpec || "cmd.exe";
    return spawn(commandInterpreter, ["/d", "/s", "/c", `npm run ${script}`], {
      stdio: "inherit",
      env: process.env
    });
  }

  return spawn("npm", ["run", script], {
    stdio: "inherit",
    env: process.env
  });
}

function start(script, label) {
  const child = spawnNpmScript(script);
  children.push(child);

  child.on("error", error => {
    if (shuttingDown) return;
    console.error(`${label} failed to start: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code !== 0) {
      console.error(`${label} exited with ${signal ?? `code ${code}`}.`);
      shutdown(code ?? 1);
    }
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill();
  }

  setTimeout(() => process.exit(code), 50);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("dev:server", "server");
start("dev:web", "web");
