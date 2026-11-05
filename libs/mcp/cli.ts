#!/usr/bin/env node
// `npx @rivetjs/mcp` / `rivet-mcp`: the Rivet MCP server over stdio. Run it from the app directory so `check_code`
// uses the app's compiler and packages. Logs go to stderr (stdout is the protocol).
// With a command (`search`, `doc`, `components`, `component`, `check`, `explain`) it runs that one tool and prints
// the result: the same lookups for agents that have a shell but no MCP client configured.
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { checkCode, formatCheck } from "./check.ts";
import { createRivetServer, SERVER_VERSION } from "./server.ts";

const HELP = `rivet-mcp: Rivet docs, component reference and code checks (offline)

Without a command: MCP server on stdio (claude mcp add rivet -- npx -y @rivetjs/mcp).
One-shot commands (run from the app directory; output on stdout):
  search <words…> [--site docs|cdk|ui] [--kind page|api|example] [--limit n]   ranked doc ids
  doc <id|path|url>                                                full page (ids from search: ui:/components/drawer/)
  components [ui|cdk|kit]                                          every component entry point
  component <Name> [--package ui|cdk|kit] [--examples n]           import path, props, parts, example source
  check <file…>                                                    Rivet compiler + language-service diagnostics with fixes
  explain <RVnnnn|all>                                             what a diagnostic means and its fix
Examples: npx -y @rivetjs/mcp component Drawer · npx -y @rivetjs/mcp search form in drawer · npx -y @rivetjs/mcp check src/routes/index.tsx
`;

const COMMANDS: Record<string, string> = {
  search: "search_docs",
  doc: "get_doc",
  components: "list_components",
  component: "get_component",
  check: "check_code",
  explain: "explain_diagnostic",
};

/** `--name value` options and the remaining words. */
function parse(argv: string[]): { words: string[]; options: Record<string, string> } {
  const words: string[] = [];
  const options: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--") && i + 1 < argv.length) options[arg.slice(2)] = argv[++i]!;
    else words.push(arg);
  }
  return { words, options };
}

async function run(command: string, argv: string[]): Promise<number> {
  const { words, options } = parse(argv);
  const cwd = process.cwd();
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createRivetServer({ cwd });
  await server.connect(a);
  const client = new Client({ name: "rivet-mcp-cli", version: SERVER_VERSION });
  await client.connect(b);
  const calls: { name: string; arguments: Record<string, unknown> }[] = [];
  const need = (what: string) => {
    if (!words.length) throw new Error(`${command}: ${what} required (rivet-mcp --help)`);
  };
  if (command === "search") {
    need("words");
    const { limit, ...rest } = options;
    calls.push({ name: "search_docs", arguments: { query: words.join(" "), ...rest, ...(limit ? { limit: Number(limit) } : {}) } });
  } else if (command === "doc") {
    need("a doc id, path or URL");
    calls.push({ name: "get_doc", arguments: { path: words[0] } });
  } else if (command === "components") {
    calls.push({ name: "list_components", arguments: words[0] ? { package: words[0] } : {} });
  } else if (command === "component") {
    need("a component name");
    calls.push({
      name: "get_component",
      arguments: {
        name: words[0],
        ...(options.package ? { package: options.package } : {}),
        ...(options.examples ? { examples: Number(options.examples) } : {}),
      },
    });
  } else if (command === "check") {
    need("a file");
    // Direct call (structured result → exit status); same output as the check_code tool.
    let errors = 0;
    for (const file of words) {
      const path = resolve(cwd, file);
      const result = checkCode(readFileSync(path, "utf8"), { filename: relative(cwd, path), cwd });
      errors += result.diagnostics.filter((d) => d.severity === "error").length + result.typescript.length;
      process.stdout.write(formatCheck(result).trimEnd() + "\n\n");
    }
    await client.close();
    return errors ? 1 : 0;
  } else {
    need("a code");
    calls.push({ name: "explain_diagnostic", arguments: { code: words[0] } });
  }
  let failed = false;
  for (const call of calls) {
    const result = (await client.callTool({ name: call.name, arguments: call.arguments })) as { content: { type: string; text?: string }[]; isError?: boolean };
    const body = result.content.map((part) => part.text ?? "").join("\n");
    process.stdout.write(body.trimEnd() + "\n");
    if (result.isError) failed = true;
  }
  await client.close();
  return failed ? 1 : 0;
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (args.includes("--version")) {
  process.stdout.write(SERVER_VERSION + "\n");
  process.exit(0);
}
const command = args[0];
if (command && !command.startsWith("-")) {
  if (!(command in COMMANDS)) {
    process.stderr.write(`rivet-mcp: unknown command "${command}"\n\n${HELP}`);
    process.exit(2);
  }
  try {
    process.exit(await run(command, args.slice(1)));
  } catch (error) {
    process.stderr.write(`rivet-mcp: ${(error as Error).message}\n`);
    process.exit(2);
  }
}
const server = createRivetServer({ cwd: process.cwd() });
await server.connect(new StdioServerTransport());
process.stderr.write(`rivet-mcp ${SERVER_VERSION}: ready on stdio\n`);
