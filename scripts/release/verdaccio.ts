// Local npm registry (Verdaccio, root devDependency) for the release end to end — project level only.
//
//   node scripts/release/verdaccio.ts start [--port 4873] [--fresh]   start in the background (pid + log in storage/)
//   node scripts/release/verdaccio.ts stop                            stop it
//   node scripts/release/verdaccio.ts status                          running? URL
//
// Config: scripts/release/verdaccio/config.yaml. Everything it writes stays in scripts/release/verdaccio/storage/
// (gitignored): published packages, the htpasswd of the throwaway e2e user, `npmrc` (the npm userconfig a run passes
// with `--userconfig`, never the user's ~/.npmrc) and `npm-cache`. `--fresh` empties storage/ first.
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

export const ROOT = resolve(import.meta.dirname, "../..");
export const DIR = join(import.meta.dirname, "verdaccio");
export const STORAGE = join(DIR, "storage");
export const CONFIG = join(DIR, "config.yaml");
/** Default port: Verdaccio's own; never 4320–4329 (other local services). */
export const DEFAULT_PORT = 4873;
/** The only npm userconfig a local publish / install uses (`userconfig()` writes it); never ~/.npmrc. */
export const USERCONFIG = join(STORAGE, "npmrc");
const HTPASSWD = join(STORAGE, "htpasswd");
const PID = join(STORAGE, "verdaccio.pid");
const LOG = join(STORAGE, "verdaccio.log");

/** Hosts a local publish may target (`assertLocalRegistry`). */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Throws unless `url` is an http(s) registry on this machine: the guard every local publish goes through. */
export function assertLocalRegistry(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`registry ${JSON.stringify(url)} is not a URL`);
  }
  if (!/^https?:$/.test(parsed.protocol) || !LOCAL_HOSTS.has(parsed.hostname))
    throw new Error(`refusing to publish to ${parsed.host || url}: local publishes go to a registry on localhost / 127.0.0.1 / [::1] only`);
  return parsed;
}

/**
 * npm flags of every npm call in the local path: the project userconfig, and the local registry for unscoped names
 * AND the `@rivetjs` scope — a scoped registry (`@rivetjs:registry` in any npmrc, or a manifest `publishConfig`)
 * otherwise wins over `--registry` and would send `@rivetjs/*` to npmjs.
 */
export function localNpmArgs(registry: string, userconfig = USERCONFIG): string[] {
  const url = assertLocalRegistry(registry).href;
  // `--noproxy`: loopback hosts never go through a proxy (proxy env vars are dropped too: `localNpmEnv`).
  return ["--userconfig", userconfig, "--registry", url, `--@rivetjs:registry=${url}`, "--noproxy=localhost,127.0.0.1,::1"];
}

/** Proxy settings a local publish drops (a proxy would see, or redirect, the local registry traffic). */
const PROXY_ENV = /^(?:https?_proxy|all_proxy|npm_config_(?:https_)?proxy)$/i;

/** Environment of every npm call in the local path: inherited `npm_config_*` dropped, userconfig / globalconfig in storage. */
export function localNpmEnv(userconfig = USERCONFIG, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(base).filter(([key]) => !/^npm_config_/i.test(key) && !PROXY_ENV.test(key)));
  return { ...env, NPM_CONFIG_USERCONFIG: userconfig, NPM_CONFIG_GLOBALCONFIG: join(dirname(userconfig), "npmrc.global") };
}

/**
 * Throws unless npm, called with `args` + `env`, resolves `registry` and `@rivetjs:registry` to `registry` (a localhost
 * URL), reads no user config but `userconfig`, and holds no credentials for a non-local host. No network.
 */
export function assertNpmTargets(registry: string, args: string[], env: NodeJS.ProcessEnv, userconfig = USERCONFIG, projectRoot = ROOT): void {
  const url = assertLocalRegistry(registry).href;
  // npm config layers the flags cannot pin away: a project `.npmrc` (repo root) or an existing global npmrc.
  if (existsSync(join(projectRoot, ".npmrc"))) throw new Error(`refusing to publish: ${join(projectRoot, ".npmrc")} exists (project npm config)`);
  for (const key of Object.keys(env)) if (PROXY_ENV.test(key)) throw new Error(`refusing to publish: proxy setting ${key} in the environment`);
  // npm (11.17, `@npmcli/redact`) masks secret-looking path segments (a UUID: `/…/d5c17ad1-…/` → `/…/***/`) in config
  // output and refuses `config get` of such a value: the checks below cannot read the paths, so they fail closed with
  // the cause named instead of a misleading "protected" / "reads the user config" refusal.
  const redacted = () =>
    new Error(
      `refusing to publish: npm redacts the config paths under ${projectRoot} (a path segment looks like a secret, e.g. a UUID), so the npm targets cannot be verified: run from a checkout path without one`,
    );
  const npm = (npmArgs: string[]) => {
    const result = spawnSync("npm", [...npmArgs, ...args], { cwd: projectRoot, env, encoding: "utf8" });
    if (result.status !== 0) {
      if (/option is protected, and cannot be retrieved/.test(result.stderr)) throw redacted();
      throw new Error(`npm ${npmArgs.join(" ")}: ${(result.stderr || result.stdout).trim()}`);
    }
    return result.stdout;
  };
  const globalconfig = npm(["config", "get", "globalconfig"]).trim();
  if (globalconfig.includes("***")) throw redacted();
  if (existsSync(globalconfig)) throw new Error(`refusing to publish: global npm config ${globalconfig} exists`);
  for (const key of ["registry", "@rivetjs:registry"]) {
    const value = npm(["config", "get", key]).trim();
    let resolved: string | undefined;
    try {
      resolved = assertLocalRegistry(value).href;
    } catch {}
    if (resolved !== url) throw new Error(`refusing to publish: npm resolves ${key} to ${value}, not ${url}`);
  }
  const list = npm(["config", "list"]);
  for (const [, file] of list.matchAll(/^; "user" config from (.+)$/gm))
    if (file!.includes("***") && !userconfig.includes("***")) throw redacted();
    else if (resolve(file!) !== resolve(userconfig)) throw new Error(`refusing to publish: npm reads the user config ${file}, not ${userconfig}`);
  for (const [, host] of list.matchAll(/^\/\/([^/\s]+)\/\S*:_(?:authToken|auth|password)\b/gm)) {
    const hostname = new URL(`http://${host}`).hostname;
    if (!LOCAL_HOSTS.has(hostname)) throw new Error(`refusing to publish: npm config holds credentials for ${host}`);
  }
}

/** Drops every `*registry*` key from a manifest's `publishConfig` (it would override the CLI registry). Returns the dropped keys. */
export function stripRegistryKeys(manifest: { publishConfig?: Record<string, unknown> }): string[] {
  const dropped = Object.keys(manifest.publishConfig ?? {}).filter((key) => /registry/i.test(key));
  for (const key of dropped) delete manifest.publishConfig![key];
  return dropped;
}

/** Pid of the Verdaccio this script started: alive, and its command line names verdaccio (a reused pid is not ours). */
const pidOf = (): number | undefined => {
  if (!existsSync(PID)) return undefined;
  const pid = Number(readFileSync(PID, "utf8").split("\n")[0]);
  if (!Number.isInteger(pid) || pid <= 0) return undefined;
  const ps = spawnSync("ps", ["-ww", "-o", "command=", "-p", String(pid)], { encoding: "utf8" });
  // Verdaccio sets its process title to `verdaccio`; before that the command is the bin `start()` spawned. A shell
  // whose command line merely mentions verdaccio (`node scripts/release/verdaccio.ts …`) does not match.
  const command = ps.stdout.trim();
  return ps.status === 0 && (/^verdaccio(\s|$)/.test(command) || command.includes(`${join(ROOT, "node_modules/verdaccio/bin/verdaccio")} --config ${CONFIG}`))
    ? pid
    : undefined;
};
const urlOf = (): string | undefined => (existsSync(PID) ? readFileSync(PID, "utf8").split("\n")[1] : undefined);

async function ping(url: string): Promise<boolean> {
  try {
    return (await fetch(new URL("-/ping", url))).ok;
  } catch {
    return false;
  }
}

/** Starts Verdaccio in the background (or returns the running one's URL). */
export async function start({ port = DEFAULT_PORT, fresh = false } = {}): Promise<string> {
  if (port >= 4320 && port <= 4329) throw new Error("ports 4320–4329 are reserved for other local services");
  const running = pidOf();
  if (running && !fresh) return urlOf()!;
  if (running) await stop();
  if (fresh) rmSync(STORAGE, { recursive: true, force: true });
  mkdirSync(STORAGE, { recursive: true });
  const url = `http://127.0.0.1:${port}/`;
  if (await ping(url)) throw new Error(`port ${port} already answers as a registry (not started by this script): stop it or pass --port`);
  const bin = join(ROOT, "node_modules/verdaccio/bin/verdaccio");
  if (!existsSync(bin)) throw new Error("verdaccio is not installed (root devDependency): run npm install");
  const log = openSync(LOG, "a");
  const child = spawn(process.execPath, [bin, "--config", CONFIG, "--listen", `127.0.0.1:${port}`], {
    cwd: DIR,
    detached: true,
    stdio: ["ignore", log, log],
    // Verdaccio's own settings stay out of ~/.config: XDG points into storage/.
    env: { ...process.env, XDG_CONFIG_HOME: join(STORAGE, "xdg"), XDG_DATA_HOME: join(STORAGE, "xdg") },
  });
  child.unref();
  closeSync(log);
  writeFileSync(PID, `${child.pid}\n${url}\n`);
  const until = Date.now() + 30_000;
  while (!(await ping(url))) {
    if (Date.now() > until || child.exitCode !== null) throw new Error(`verdaccio did not answer on ${url} (log: ${LOG})`);
    await new Promise((done) => setTimeout(done, 200));
  }
  return url;
}

/** Stops the Verdaccio this script started. */
export async function stop(): Promise<void> {
  const pid = pidOf();
  if (pid) {
    process.kill(pid, "SIGTERM");
    const until = Date.now() + 10_000;
    while (pidOf() && Date.now() < until) await new Promise((done) => setTimeout(done, 100));
    if (pidOf()) process.kill(pid, "SIGKILL");
  }
  rmSync(PID, { force: true });
}

/**
 * Writes a throwaway user into `storage/htpasswd` (registration is off: `max_users: -1`), logs it in (CouchDB user API,
 * as `npm login` does) and writes `storage/npmrc`: registry + scope registry + its auth token, mode 0600. npm gets that
 * file through `--userconfig` + `NPM_CONFIG_USERCONFIG` (`localNpmArgs` / `localNpmEnv`); never the user's own npmrc.
 */
export async function userconfig(url: string): Promise<string> {
  const registry = assertLocalRegistry(url);
  const name = `e2e-${Date.now().toString(36)}`;
  const password = randomUUID();
  // htpasswd `{SHA}` entry (verdaccio-htpasswd verifies it); Verdaccio re-reads the file when it changes.
  writeFileSync(HTPASSWD, `${name}:{SHA}${createHash("sha1").update(password).digest("base64")}:autocreated ${new Date().toISOString()}\n`, { mode: 0o600 });
  chmodSync(HTPASSWD, 0o600);
  const response = await fetch(new URL(`-/user/org.couchdb.user:${name}`, registry), {
    method: "PUT",
    // Basic auth = log in the pre-seeded user (registration is off); Verdaccio answers with a token.
    headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${name}:${password}`).toString("base64")}` },
    body: JSON.stringify({ _id: `org.couchdb.user:${name}`, name, password, type: "user", roles: [], date: new Date().toISOString() }),
  });
  const body = (await response.json()) as { token?: string; error?: string };
  if (!response.ok || !body.token) throw new Error(`verdaccio user ${name}: ${response.status} ${body.error ?? ""}`);
  const file = USERCONFIG;
  const host = registry.host;
  writeFileSync(
    file,
    `registry=${registry.href}\n@rivetjs:registry=${registry.href}\n//${host}/:_authToken=${body.token}\ncache=${join(STORAGE, "npm-cache")}\nfund=false\naudit=false\nupdate-notifier=false\n`,
    { mode: 0o600 },
  );
  chmodSync(file, 0o600);
  return file;
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { port: { type: "string" }, fresh: { type: "boolean", default: false } },
  });
  const command = positionals[0];
  try {
    if (command === "start") {
      const running = !values.fresh && pidOf() !== undefined && existsSync(USERCONFIG);
      const url = await start({ port: Number(values.port ?? DEFAULT_PORT), fresh: values.fresh });
      // A throwaway user + storage/npmrc, so `release.ts --registry` (which requires that userconfig) works right away;
      // an instance already running keeps its user and npmrc (htpasswd is not rewritten).
      const npmrc = running ? USERCONFIG : await userconfig(url);
      console.log(`verdaccio: ${url}${running ? " (already running)" : ""} (storage ${STORAGE}, npm userconfig ${npmrc})`);
    } else if (command === "stop") {
      await stop();
      console.log("verdaccio: stopped");
    } else if (command === "status") {
      const pid = pidOf();
      console.log(pid ? `verdaccio: running (pid ${pid}) on ${urlOf()}` : "verdaccio: not running");
    } else throw new Error("usage: node scripts/release/verdaccio.ts <start [--port N] [--fresh] | stop | status>");
  } catch (error) {
    console.error(`verdaccio: ${(error as Error).message}`);
    process.exit(1);
  }
}
