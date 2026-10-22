import { defineConfig, type Plugin } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Server data as a virtual module (both environments resolve it; the router keeps it out of browser code).
const secret: Plugin = {
  name: "fixture-secret",
  resolveId: (id) => (id === "virtual:fixture-secret" ? "\0fixture-secret" : null),
  load: (id) => (id === "\0fixture-secret" ? 'export default "server secret";' : null),
};

// Document links (`tests/document-links.test.ts`): links to URLs no page route matches load documents, so do links to
// document routes (pages whose browser graph reaches a server-only module: `report`, `secret`).
export default defineConfig({ plugins: [rivetRouter({ clientRouter: true, serverOnly: ["virtual:fixture-secret"] }), secret], logLevel: "warn" });
