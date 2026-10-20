import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Server code in the page file",
  summary: "A page file with load(…) and onGet(…) exports next to its component, and a plain .ts endpoint. The compiler strips the server code from the browser build.",
  tags: ["routing", "loaders", "endpoints"],
  status: "experimental",
  mode: "server",
  show: ["src/routes/index.tsx", "src/routes/api/time.ts", "src/books.server.ts"],
});
