export interface PresetGeneratorSchema {
  /** Workspace name (create-nx-workspace passes it); the default app name. */
  name: string;
  /** Name of the first app (default: the workspace name). */
  appName?: string;
  /** Folder of the first app (default `apps/<appName>`). */
  directory?: string;
  template?: "static" | "server" | "ui" | "minimal";
  adapter?: "node" | "static";
  deploy?: "vercel" | "netlify" | "cloudflare" | "bun" | "deno";
  tailwind?: boolean;
  unitTestRunner?: "vitest" | "none";
  rivetVersion?: string;
  skipInstall?: boolean;
  skipFormat?: boolean;
}
