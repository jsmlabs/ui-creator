import { DEFAULT_BREAKPOINTS, DEFAULT_THEMES, DEFAULT_TOKENS } from "./defaults.js";
import { CURRENT_SCHEMA_VERSION, type Project } from "./types.js";

type UnknownProject = Record<string, unknown> & { schemaVersion?: unknown };
type Migration = { from: number; to: number; migrate(input: UnknownProject): UnknownProject; };

const migration1To2: Migration = {
  from: 1,
  to: 2,
  migrate(input) {
    const next = structuredClone(input);
    const tokens = typeof next.tokens === "object" && next.tokens !== null ? next.tokens as Record<string, unknown> : {};
    const themes = typeof next.themes === "object" && next.themes !== null ? next.themes as Record<string, unknown> : {};
    const settings = typeof next.settings === "object" && next.settings !== null ? next.settings as Record<string, unknown> : {};
    const breakpoints = typeof settings.breakpoints === "object" && settings.breakpoints !== null ? settings.breakpoints as Record<string, unknown> : {};
    next.tokens = { ...structuredClone(DEFAULT_TOKENS), ...tokens };
    next.themes = { ...structuredClone(DEFAULT_THEMES), ...themes };
    settings.breakpoints = { ...DEFAULT_BREAKPOINTS, ...breakpoints };
    if (!("activeThemeId" in settings)) settings.activeThemeId = null;
    next.settings = settings;
    return next;
  }
};

const migration2To3: Migration = {
  from: 2,
  to: 3,
  migrate(input) {
    const next = structuredClone(input);
    const variables = typeof next.variables === "object" && next.variables !== null ? next.variables as Record<string, any> : {};
    const migratedVariables: Record<string, unknown> = {};
    for (const [id, variable] of Object.entries(variables)) {
      if (!variable || typeof variable !== "object") continue;
      if ("initialValue" in variable && "type" in variable) migratedVariables[id] = variable;
      else {
        const value = variable.value;
        const type = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
        migratedVariables[id] = { id, name: typeof variable.name === "string" ? variable.name : id, type, initialValue: value ?? "" };
      }
    }
    next.variables = migratedVariables;
    if (!next.interactions || typeof next.interactions !== "object") next.interactions = {};
    return next;
  }
};

const migrations: Migration[] = [migration1To2, migration2To3];

export class UnsupportedSchemaVersionError extends Error {
  constructor(version: unknown) {
    super(`Unsupported project schema version: ${String(version)}`);
    this.name = "UnsupportedSchemaVersionError";
  }
}

export function migrateProject(input: UnknownProject): Project {
  if (!Number.isInteger(input.schemaVersion)) throw new UnsupportedSchemaVersionError(input.schemaVersion);
  let current = structuredClone(input);
  let version = current.schemaVersion as number;
  if (version > CURRENT_SCHEMA_VERSION || version < 1) throw new UnsupportedSchemaVersionError(version);
  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations.find(candidate => candidate.from === version);
    if (!migration) throw new Error(`Missing migration from schema ${version}`);
    current = migration.migrate(current);
    version = migration.to;
    current.schemaVersion = version;
  }
  return current as unknown as Project;
}
