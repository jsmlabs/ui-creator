function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      output[key] = normalize(record[key]);
    }

    return output;
  }

  return value;
}

export function stableStringify(value: unknown, space = 2): string {
  return `${JSON.stringify(normalize(value), null, space)}\n`;
}

export function parseJson<T>(input: string): T {
  return JSON.parse(input) as T;
}
