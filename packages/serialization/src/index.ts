import { parseJson, stableStringify } from "../../shared/src/index.js";
import { migrateProject, type Project } from "../../schema/src/index.js";
import { validateProjectOrThrow } from "../../validation/src/index.js";

export function serializeProject(project: Project): string {
  validateProjectOrThrow(project);
  return stableStringify(project);
}

export function deserializeProject(input: string): Project {
  const raw = parseJson<Record<string, unknown>>(input);
  const migrated = migrateProject(raw);
  validateProjectOrThrow(migrated);
  return migrated;
}
