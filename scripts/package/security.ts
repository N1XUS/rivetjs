// Build npm tarballs, then test a Linux/Node 24 production consumer with no workspace package aliases.
// node scripts/package/security.ts [--image <cached Node 24 image>] [--no-pack] [--no-image]
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { buildPackage } from "./build.ts";

const root = resolve(import.meta.dirname, "../..");
const work = resolve(root, ".artifacts/packaged-security");
const fixture = resolve(root, "scripts/package/security-fixture");
const args = process.argv.slice(2);
const tag = "rivet-packaged-security:audit";
const run = (cmd: string, argv: string[], capture = false): string => {
  const result = spawnSync(cmd, argv, { cwd: root, encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 2);
  }
  return result.stdout ?? "";
};
mkdirSync(resolve(work, "tarballs"), { recursive: true });
mkdirSync(resolve(work, "results"), { recursive: true });
if (!args.includes("--no-pack")) {
  rmSync(resolve(work, "tarballs"), { recursive: true, force: true });
  mkdirSync(resolve(work, "tarballs"));
  const packages = [];
  for (const name of ["reactivity", "runtime", "compiler", "router", "kit", "devtools"]) {
    const dist = resolve(work, "packages", name);
    const result = buildPackage("libs/" + name, dist, { typecheck: false });
    if (result.warnings.length) throw new Error(result.warnings.join("\n"));
    const file = run("npm", ["pack", dist, "--pack-destination", resolve(work, "tarballs"), "--silent"], true)
      .trim()
      .split("\n")
      .at(-1)!;
    const manifest = JSON.parse(readFileSync(resolve(dist, "package.json"), "utf8"));
    packages.push({
      name: manifest.name,
      version: manifest.version,
      file,
      sha256: createHash("sha256")
        .update(readFileSync(resolve(work, "tarballs", file)))
        .digest("hex"),
    });
  }
  writeFileSync(resolve(work, "tarballs.json"), JSON.stringify(packages, null, 2) + "\n");
}
rmSync(resolve(work, "fixture"), { recursive: true, force: true });
cpSync(fixture, resolve(work, "fixture"), { recursive: true });
cpSync(resolve(fixture, "Dockerfile"), resolve(work, "Dockerfile"));
cpSync(resolve(fixture, ".dockerignore"), resolve(work, ".dockerignore"));
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const files = readdirSync(fixture, { recursive: true, withFileTypes: true })
  .filter((f) => f.isFile())
  .map((f) => resolve(f.parentPath, f.name).slice(fixture.length + 1))
  .sort();
const manifest = {
  tarballs: JSON.parse(readFileSync(resolve(work, "tarballs.json"), "utf8")),
  fixture: files.map((file) => ({ file, sha256: sha(resolve(fixture, file)) })),
};
const listed = manifest.tarballs.map((t: { file: string }) => t.file).sort();
if (JSON.stringify(listed) !== JSON.stringify(readdirSync(resolve(work, "tarballs")).sort()))
  throw new Error("Tarball directory disagrees with manifest; repack without --no-pack");
for (const t of manifest.tarballs) if (sha(resolve(work, "tarballs", t.file)) !== t.sha256) throw new Error("Tarball changed: " + t.file);
writeFileSync(resolve(work, "audit-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const manifestSha = sha(resolve(work, "audit-manifest.json"));
const imageAt = args.indexOf("--image");
if (!args.includes("--no-image")) run("docker", ["build", ...(imageAt < 0 ? [] : ["--build-arg", "BASE_IMAGE=" + args[imageAt + 1]]), "-t", tag, work]);
const head = run("git", ["rev-parse", "HEAD"], true).trim();
const image = JSON.parse(run("docker", ["image", "inspect", tag], true))[0];
writeFileSync(
  resolve(work, "run.json"),
  JSON.stringify(
    { head, image: image.Id, architecture: image.Architecture, tarballs: JSON.parse(readFileSync(resolve(work, "tarballs.json"), "utf8")) },
    null,
    2,
  ) + "\n",
);
run("docker", [
  "run",
  "--rm",
  "--network",
  "none",
  "--env",
  "AUDIT_MANIFEST_SHA256=" + manifestSha,
  "--memory",
  "3g",
  "--cpus",
  "2",
  "--volume",
  resolve(work, "results") + ":/results",
  tag,
]);
