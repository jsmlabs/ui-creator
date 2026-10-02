import { CURRENT_SCHEMA_VERSION, type Project } from "./types.js";

type UnknownProject = Record<string, unknown> & { schemaVersion?: unknown };
type Migration = { from: number; to: number; migrate(input: UnknownProject): UnknownProject; };
const migrations: Migration[] = [];

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
