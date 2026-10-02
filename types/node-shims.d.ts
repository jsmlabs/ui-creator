declare namespace NodeJS {
  interface ErrnoException extends Error { code?: string; }
}

declare module "node:path" {
  const path: {
    join(...parts: string[]): string;
  };
  export default path;
}

declare module "node:fs/promises" {
  export function mkdir(path: string, options?: unknown): Promise<unknown>;
  export function readFile(path: string, encoding: string): Promise<string>;
  export function readdir(path: string, options: { withFileTypes: true }): Promise<Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function rm(path: string, options?: unknown): Promise<void>;
  export function stat(path: string): Promise<{ mtime: Date }>;
  export function writeFile(path: string, data: string, options?: unknown): Promise<void>;
  export function open(path: string, flags: string): Promise<{ writeFile(data: string, options?: unknown): Promise<void>; sync(): Promise<void>; close(): Promise<void> }>;
  export function unlink(path: string): Promise<void>;
  export function copyFile(source: string, destination: string): Promise<void>;
}

declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    };
    close(): void;
  }
}
