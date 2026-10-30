import { fork, execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../", import.meta.url));
const repo = resolve(source, "../..");
export interface AppFixture {
  root: string;
  base: string;
  artifacts: string;
  close(): Promise<void>;
}

export async function startApp(label: string): Promise<AppFixture> {
  const parent = join(repo, ".artifacts/operations-tests");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, label + "-"));
  for (const file of ["src", "vite.config.ts", "tsconfig.json", "package.json", "serve.mjs"])
    await cp(join(source, file), join(root, file), { recursive: true });
  const artifacts = join(root, "evidence");
  await mkdir(artifacts);
  const env = { ...process.env, NODE_ENV: "production", OPERATIONS_DB: join(root, "operations.sqlite"), PORT: "0", HOST: "127.0.0.1" };
  for (const args of [["build"], ["build", "--ssr"]]) {
    try {
      execFileSync(process.execPath, [join(repo, "node_modules/vite/bin/vite.js"), ...args], { cwd: root, env, stdio: "pipe", timeout: 120000 });
    } catch (error) {
      await writeFile(join(artifacts, "build.log"), String(error));
      throw error;
    }
  }
  const child = fork(join(root, "serve.mjs"), [], { cwd: root, env, execArgv: [], stdio: ["ignore", "pipe", "pipe", "ipc"] });
  let log = "";
  child.stdout?.on("data", (chunk) => {
    log += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    log += String(chunk);
  });
  const exited = new Promise<void>((done) => child.once("close", () => done()));
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    const force = setTimeout(() => {
      child.kill("SIGKILL");
    }, 5000);
    try {
      await exited;
    } finally {
      clearTimeout(force);
      await writeFile(join(artifacts, "server.log"), log);
    }
  };
  try {
    const base = await new Promise<string>((done, fail) => {
      const timer = setTimeout(() => fail(new Error("Operations server readiness timeout: " + log)), 10000);
      const stop = () => clearTimeout(timer);
      child.once("error", (error) => {
        stop();
        fail(error);
      });
      child.once("exit", (code) => {
        stop();
        fail(new Error(`Operations server exited ${code}: ${log}`));
      });
      child.on("message", (message) => {
        const url = (message as { url?: string }).url;
        if (url) {
          stop();
          done(url);
        }
      });
    });
    return { root, base, artifacts, close };
  } catch (error) {
    await close();
    throw error;
  }
}
