#!/usr/bin/env node
// `npx @rivetjs/mcp` / `rivet-mcp`: the Rivet MCP server over stdio. Run it from the app directory so `check_code`
// uses the app's compiler and packages. Logs go to stderr (stdout is the protocol).
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRivetServer, SERVER_VERSION } from "./server.ts";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  process.stderr.write(
    "rivet-mcp: Rivet MCP server (stdio)\n" +
      "Tools: search_docs, get_doc, list_components, get_component, check_code, explain_diagnostic.\n" +
      "Run from your app directory. Claude Code: claude mcp add rivet -- npx -y @rivetjs/mcp\n",
  );
  process.exit(0);
}
if (args.includes("--version")) {
  process.stdout.write(SERVER_VERSION + "\n");
  process.exit(0);
}
const server = createRivetServer({ cwd: process.cwd() });
await server.connect(new StdioServerTransport());
process.stderr.write(`rivet-mcp ${SERVER_VERSION}: ready on stdio\n`);
