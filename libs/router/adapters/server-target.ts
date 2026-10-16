// Options shared by the self-hosted runtime targets (Bun, Deno): listening address and client files.
import type { BuildManifests } from "./assemble.ts";

export interface ServerTargetOptions {
  /** Client build directory (default: `../client/` next to the generated entry). */
  client?: string | URL;
  /** Port (default `$PORT`, else 3000). */
  port?: number;
  /** Address (default `$HOST`, else `0.0.0.0`: the platform's container network). */
  hostname?: string;
  /** Stop gracefully on SIGTERM / SIGINT (default true). */
  signals?: boolean;
}

const env = (name: string): string | undefined => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];

export function listenOptions({ port, hostname }: Pick<ServerTargetOptions, "port" | "hostname">): { port: number; hostname: string } {
  return { port: port ?? Number(env("PORT") ?? 3000), hostname: hostname ?? env("HOST") ?? "0.0.0.0" };
}

/** URL prefixes of hashed files: each client build's `assets/` (one per locale with i18n). */
export function immutableOf(base: string, build: BuildManifests): string[] {
  return build.clients.map((client) => (client.base || base + "/") + "assets/");
}
