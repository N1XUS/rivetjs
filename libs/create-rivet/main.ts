// The create-rivet command: arguments (node:util parseArgs), questions (./prompt.ts), then ./index.ts does the work.
//   npm create rivet@latest [dir] [-- --template <id>] [--yes] [--no-install] [--no-git] …
import { basename, relative, resolve } from "node:path";
import { parseArgs, styleText } from "node:util";
import {
  commands,
  createProject,
  detectPackageManager,
  findTemplate,
  initGit,
  installDependencies,
  isEmptyDir,
  isFile,
  ownVersion,
  PACKAGE_MANAGERS,
  TEMPLATES,
  toPackageName,
  validatePackageName,
  type PackageManager,
  type TemplateId,
} from "./index.ts";
import { DEPLOY_TARGETS, deployOverlay, deployProblem, findDeployTarget, type DeployTarget } from "./deploy.ts";
import { closePrompts, confirm, PromptCancelled, select, text, type PromptIO } from "./prompt.ts";

export const HELP = `Create a Rivet app.

Usage:
  npm create rivet@latest [dir] [-- options]
  pnpm create rivet [dir] [options]   yarn create rivet [dir] [options]   bun create rivet [dir] [options]

Options:
  -t, --template <id>     ${TEMPLATES.map((t) => t.id).join(" | ")} (asked when omitted; default static)
  -d, --deploy <target>   ${DEPLOY_TARGETS.map((t) => t.id).join(" | ")} (default: none = Node server / static files)
  -n, --name <name>       package.json name (default: the folder name)
  -y, --yes               accept the defaults, ask nothing
      --install / --no-install   install dependencies (default: yes)
      --git / --no-git           git init + first commit (default: yes)
      --pm <name>         ${PACKAGE_MANAGERS.join(" | ")} (default: the one running create, else npm)
      --rivet-version <spec>     @rivetjs/* dependency spec (default: this release)
  -f, --force             write into a folder that is not empty
  -h, --help              this text
  -v, --version           create-rivet version

Templates:
${TEMPLATES.map((t) => `  ${t.id.padEnd(9)} ${t.label}: ${t.hint}`).join("\n")}
`;

export interface MainIO extends PromptIO {
  error: NodeJS.WritableStream;
  cwd: string;
  env: Record<string, string | undefined>;
}

/** Runs the command; resolves with the exit code (0 ok, 1 error, 130 cancelled). */
export async function main(argv: string[], io: MainIO): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      allowNegative: true,
      options: {
        template: { type: "string", short: "t" },
        deploy: { type: "string", short: "d" },
        name: { type: "string", short: "n" },
        yes: { type: "boolean", short: "y" },
        install: { type: "boolean" },
        git: { type: "boolean" },
        pm: { type: "string" },
        "rivet-version": { type: "string" },
        force: { type: "boolean", short: "f" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error) {
    io.error.write(`${(error as Error).message}\n\n${HELP}`);
    return 1;
  }
  const { values, positionals } = args;
  const paint = (format: Parameters<typeof styleText>[0], value: string) => styleText(format, value, { stream: io.output as NodeJS.WriteStream });
  if (values.help) return (io.output.write(HELP), 0);
  if (values.version) return (io.output.write(ownVersion() + "\n"), 0);
  if (positionals.length > 1) return fail(io, `Expected one folder, got ${positionals.join(" ")}`);
  if (values.template && !findTemplate(values.template)) return fail(io, `Unknown template "${values.template}" (${TEMPLATES.map((t) => t.id).join(", ")})`);
  if (values.deploy && !findDeployTarget(values.deploy))
    return fail(io, `Unknown deploy target "${values.deploy}" (${DEPLOY_TARGETS.map((t) => t.id).join(", ")})`);
  if (values.pm && !(PACKAGE_MANAGERS as readonly string[]).includes(values.pm))
    return fail(io, `Unknown package manager "${values.pm}" (${PACKAGE_MANAGERS.join(", ")})`);
  if (values.name && validatePackageName(values.name)) return fail(io, `--name: ${validatePackageName(values.name)}`);

  // Questions only on a terminal and without --yes; otherwise every missing answer takes its default.
  const ask = !values.yes && Boolean(io.input.isTTY);
  try {
    io.output.write(`\n${paint(["bold", "blue"], "create-rivet")} ${paint("dim", "v" + ownVersion())}\n\n`);
    let name = values.name;
    let folder = positionals[0];
    if (!folder) {
      const answer = ask
        ? await text(io, "Project name:", "rivet-app", (value) => validatePackageName(toPackageName(value)) && "Not a usable name")
        : "rivet-app";
      folder = answer;
      name ??= toPackageName(basename(answer));
    }
    const dir = resolve(io.cwd, folder);
    name ??= toPackageName(basename(dir));
    if (isFile(dir)) return fail(io, `${folder} is a file`);
    if (!isEmptyDir(dir) && !values.force) {
      if (!ask) return fail(io, `${folder} is not empty (use --force to write into it)`);
      if (!(await confirm(io, `${folder} is not empty. Write into it anyway (files with the same names are replaced)?`, false))) return cancelled(io);
    }
    const template = (
      values.template
        ? findTemplate(values.template)!.id
        : ask
          ? await select(
              io,
              "Template:",
              TEMPLATES.map((t) => ({ value: t.id, label: t.label, hint: t.hint })),
            )
          : "static"
    ) as TemplateId;
    let deploy = values.deploy as DeployTarget | undefined;
    if (deploy && deployProblem(deploy, template)) return fail(io, deployProblem(deploy, template)!);
    if (!deploy && ask) {
      const choices = [
        { value: "none", label: "None", hint: template === "server" ? "Node server (serve.js, Dockerfile)" : "static files (dist/client)" },
        ...DEPLOY_TARGETS.filter((t) => !deployProblem(t.id, template)).map((t) => ({ value: t.id, label: t.label, hint: t.hint })),
      ];
      const answer = await select(io, "Deploy target:", choices);
      if (answer !== "none") deploy = answer as DeployTarget;
    }
    const pm = (values.pm ?? detectPackageManager(io.env["npm_config_user_agent"])) as PackageManager;
    const install = values.install ?? (ask ? await confirm(io, `Install dependencies with ${pm}?`, true) : true);
    const git = values.git ?? (ask ? await confirm(io, "Initialise a git repository?", true) : true);
    closePrompts(io);

    const created = createProject({
      dir,
      template,
      name,
      ...(values["rivet-version"] ? { rivetVersion: values["rivet-version"] } : {}),
      ...(deploy ? { overlays: [deployOverlay(deploy, pm)] } : {}),
    });
    io.output.write(
      `${paint("green", "Created")} ${created.name} (${findTemplate(template)!.label}${deploy ? ", " + findDeployTarget(deploy)!.label : ""}) in ${dir} — ${created.files.length} files\n`,
    );
    const run = commands(pm);
    let installed = false;
    if (install) {
      io.output.write(`\n${paint("dim", "$ " + run.install)}\n`);
      installed = installDependencies(dir, pm);
      if (!installed) io.error.write(paint("yellow", `\n${run.install} failed; run it yourself in ${folder}.\n`));
    }
    if (git) {
      const result = initGit(dir);
      if (result === "committed") io.output.write(`${paint("green", "Git")} repository created with a first commit\n`);
      else if (result === "created") io.output.write(`${paint("green", "Git")} repository created (files staged; no commit: set git user.name / user.email)\n`);
      else if (result === "inside-repo") io.output.write(`${paint("dim", "Git: already inside a repository, skipped")}\n`);
      else io.output.write(`${paint("dim", "Git: not available, skipped")}\n`);
    }
    const cd = relative(io.cwd, dir) || ".";
    io.output.write(`\nNext:\n`);
    if (cd !== ".") io.output.write(`  cd ${cd.includes(" ") ? JSON.stringify(cd) : cd}\n`);
    if (!installed) io.output.write(`  ${run.install}\n`);
    io.output.write(`  ${run.run("dev")}\n\n`);
    return 0;
  } catch (error) {
    if (error instanceof PromptCancelled) return cancelled(io);
    return fail(io, (error as Error).message);
  } finally {
    closePrompts(io);
  }
}

function fail(io: MainIO, message: string): number {
  io.error.write(styleText("red", "Error: ", { stream: io.error as NodeJS.WriteStream }) + message + "\n");
  return 1;
}

function cancelled(io: MainIO): number {
  io.error.write("Cancelled.\n");
  return 130;
}
