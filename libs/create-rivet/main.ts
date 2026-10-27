// The create-rivet command: arguments (node:util parseArgs), questions (./prompt.ts), then ./index.ts does the work.
//   npm create rivet@latest [dir] [-- --template <id>] [--yes] [--no-install] [--no-git] …
import { paint as color, progress, suggestion, summary, debugEnabled } from "./output.ts";
import { basename, relative, resolve } from "node:path";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";
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
      --quiet             errors only; accept defaults without prompts
      --json              one JSON result; accept defaults without prompts
      --verbose           include error stacks and install output (also DEBUG=rivet)
  -f, --force             write into a folder that is not empty
  -h, --help              this text
  -v, --version           create-rivet version

Examples:
  npm create rivet@latest my-app -- --template server --yes
  npm create rivet@latest my-app -- --no-install --no-git --json

Exit status: 0 success, 1 failure, 2 usage error, 130 cancelled.

Templates:
${TEMPLATES.map((t) => `  ${t.id.padEnd(9)} ${t.label}: ${t.hint}`).join("\n")}
`;

export interface MainIO extends PromptIO {
  error: NodeJS.WritableStream;
  cwd: string;
  env: Record<string, string | undefined>;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

/** Runs the command; resolves with the exit code (0 ok, 1 failure, 2 usage, 130 cancelled). */
export async function main(argv: string[], io: MainIO): Promise<number> {
  const resultOutput = io.output;
  io = { ...io, json: argv.includes("--json"), quiet: argv.includes("--quiet"), verbose: argv.includes("--verbose") || debugEnabled(io.env) };
  const started = performance.now();
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      allowNegative: true,
      options: {
        quiet: { type: "boolean" },
        json: { type: "boolean" },
        verbose: { type: "boolean" },
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
    const message = (error as Error).message;
    const unknown = /Unknown option '([^']+)'/.exec(message)?.[1];
    return fail(
      io,
      message +
        (unknown
          ? suggestion(unknown, [
              "--template",
              "--deploy",
              "--name",
              "--yes",
              "--install",
              "--no-install",
              "--git",
              "--no-git",
              "--pm",
              "--rivet-version",
              "--force",
              "--help",
              "--version",
              "--quiet",
              "--json",
              "--verbose",
            ])
          : ""),
      2,
    );
  }
  const { values, positionals } = args;
  io = { ...io, json: !!values.json, quiet: !!values.quiet, verbose: !!values.verbose || debugEnabled(io.env) };
  const paint = (format: Parameters<typeof color>[0], value: string) => color(format, value, io.output, io.env);
  if (values.help) return (io.output.write(HELP), 0);
  if (values.version) return (io.output.write(ownVersion() + "\n"), 0);
  if (positionals.length > 1) return fail(io, `Expected one folder, got ${positionals.join(" ")}`, 2);
  if (values.template && !findTemplate(values.template)) return fail(io, `Unknown template "${values.template}" (${TEMPLATES.map((t) => t.id).join(", ")})`, 2);
  if (values.deploy && !findDeployTarget(values.deploy))
    return fail(io, `Unknown deploy target "${values.deploy}" (${DEPLOY_TARGETS.map((t) => t.id).join(", ")})`, 2);
  if (values.pm && !(PACKAGE_MANAGERS as readonly string[]).includes(values.pm))
    return fail(io, `Unknown package manager "${values.pm}" (${PACKAGE_MANAGERS.join(", ")})`, 2);
  if (values.name && validatePackageName(values.name)) return fail(io, `--name: ${validatePackageName(values.name)}`, 2);

  // Questions only on a terminal and without --yes; otherwise every missing answer takes its default.
  const ask = !values.yes && !io.quiet && !io.json && !io.env.CI && Boolean(io.input.isTTY);
  // Keep one result on stdout in JSON mode; status text has a private sink.
  const diagnosticsIO = io;
  if (io.quiet || io.json)
    io = {
      ...io,
      output: new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      }),
    };
  let warnings = 0,
    errors = 0;
  const diagnostics: { severity: "error" | "warning"; message: string; fix: string; details?: string }[] = [];
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
    if (isFile(dir)) return fail(diagnosticsIO, `${folder} is a file`);
    if (!isEmptyDir(dir) && !values.force) {
      if (!ask) return fail(diagnosticsIO, `${folder} is not empty (use --force to write into it)`);
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
    if (deploy && deployProblem(deploy, template)) return fail(diagnosticsIO, deployProblem(deploy, template)!, 2);
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
      const task = progress(`create-rivet: installing with ${pm}`, { stream: io.output, env: io.env, quiet: io.quiet || io.json });
      let output = "";
      try {
        installed = await installDependencies(dir, pm, {
          stdio: "pipe",
          env: { ...process.env, ...io.env, NO_COLOR: "1", FORCE_COLOR: "0" },
          onOutput(text) {
            output = (output + text).slice(-65536);
          },
        });
      } finally {
        task.stop(installed ? "Dependencies installed" : "Dependency install failed");
      }
      if (!installed) {
        errors++;
        diagnostics.push({
          severity: "error",
          message: `${run.install} failed in ${dir}`,
          fix: `Run ${run.install} in ${folder} after addressing the package manager error.`,
          details: output,
        });
        if (!io.json)
          io.error.write(
            `error: ${run.install} failed in ${dir}.\n  fix: Run ${run.install} in ${folder} and address the package manager error below.\n${output}\n`,
          );
      }
      if (installed && io.verbose && !io.json) io.error.write(output);
    }
    if (git) {
      const task = progress("create-rivet: initializing git", { stream: io.output, env: io.env, quiet: io.quiet || io.json });
      let result: ReturnType<typeof initGit>;
      try {
        result = initGit(dir);
      } finally {
        task.stop("Git step finished");
      }
      if (result === "no-git" || result === "created") warnings++;
      if (result === "failed") errors++;
      if (result === "failed" || result === "created" || result === "no-git")
        diagnostics.push({
          severity: result === "failed" ? "error" : "warning",
          message: `Git step in ${dir}: ${result}`,
          fix:
            result === "no-git"
              ? "Install Git, then run git init in the created folder."
              : "Run git status and check git user.name / user.email in the created folder.",
        });
      if (result === "committed") io.output.write(`${paint("green", "Git")} repository created with a first commit\n`);
      else if (result === "created")
        io.output.write(
          `${paint("yellow", "warning: Git")} repository created (files staged; commit not created). Run git status and check git user.name / user.email.\n`,
        );
      else if (result === "inside-repo") io.output.write(`${paint("dim", "Git: already inside a repository, skipped")}\n`);
      else if (result === "failed") {
        if (!io.json) io.error.write(`error: Git initialization failed in ${dir}.\n  fix: Run git init and git add in that folder to inspect the failure.\n`);
      } else io.output.write(`${paint("yellow", "warning: Git is not available, skipped; install Git to initialize later.")}\n`);
    }
    const cd = relative(io.cwd, dir) || ".";
    io.output.write(`\nNext:\n`);
    if (cd !== ".") io.output.write(`  cd ${cd.includes(" ") ? JSON.stringify(cd) : cd}\n`);
    if (!installed) io.output.write(`  ${run.install}\n`);
    io.output.write(`  ${run.run("dev")}\n\n`);
    const durationMs = Math.round(performance.now() - started);
    if (io.json)
      resultOutput.write(
        JSON.stringify({
          directory: dir,
          template,
          installed,
          errors,
          diagnostics,
          warnings,
          durationMs,
          ...(errors ? { fix: diagnostics.find((diagnostic) => diagnostic.severity === "error")!.fix } : {}),
        }) + "\n",
      );
    else if (!io.quiet) io.output.write(`create-rivet: ${summary(errors, warnings)} in ${(durationMs / 1000).toFixed(1)} s\n`);
    return errors ? 1 : 0;
  } catch (error) {
    if (error instanceof PromptCancelled) return cancelled(io);
    return fail(diagnosticsIO, (error as Error).message, 1, error);
  } finally {
    closePrompts(io);
  }
}

function fail(io: MainIO, message: string, exitCode = 1, error?: unknown): number {
  const fix = exitCode === 2 ? "Run create-rivet --help and correct the argument." : "Check the target directory and permissions, then retry.";
  if (io.json)
    io.output.write(JSON.stringify({ error: message, fix, exitCode, ...(io.verbose && error instanceof Error ? { stack: error.stack } : {}) }) + "\n");
  else
    io.error.write(
      color("red", "Error: ", io.error, io.env) + message + `\n  fix: ${fix}\n` + (io.verbose && error instanceof Error ? error.stack + "\n" : ""),
    );
  return exitCode;
}

function cancelled(io: MainIO): number {
  io.error.write("Cancelled.\n");
  return 130;
}
