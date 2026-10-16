// Docs site commands, run against one app root:
//   node libs/docs-kit/cli.ts <build|check-examples|examples|api|prepare|check-content|check-snippets|serve|llms> <app root> [options]
import { resolve } from "node:path";

const [command, root, ...args] = process.argv.slice(2);
if (!command || !root) {
  console.error("usage: docs-kit <build|check-examples|examples|api|prepare|check-content|check-snippets|serve|llms> <app root> [options]");
  process.exit(2);
}
const appRoot = resolve(root);
switch (command) {
  case "build":
    await (await import("./tools/build.ts")).buildCommand(appRoot, args);
    break;
  case "check-examples":
    await (await import("./tools/check-examples.ts")).checkExamplesCommand(appRoot, args);
    break;
  case "examples":
    await (await import("./tools/examples.ts")).examplesCommand(appRoot);
    break;
  case "api":
    await (await import("./tools/api.ts")).apiCommand(appRoot, args);
    break;
  case "prepare":
    await (await import("./tools/prepare.ts")).prepare(appRoot);
    break;
  case "check-content":
    await (await import("./tools/check-content.ts")).checkContentCommand(appRoot, args);
    break;
  case "check-snippets":
    await (await import("./tools/check-snippets.ts")).checkSnippetsCommand(appRoot, args);
    break;
  case "serve":
    await (await import("./tools/serve.ts")).serveCommand(appRoot, args);
    break;
  case "llms":
    await (await import("./tools/llms/generate.ts")).llmsCommand(appRoot, args);
    break;
  default:
    console.error(`docs-kit: unknown command ${command}`);
    process.exit(2);
}
