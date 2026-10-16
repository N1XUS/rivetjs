import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Protected pages",
  summary: "One guard in a folder layout protects every page inside it and sends signed-out visitors to the sign-in page.",
  tags: ["routing", "guards", "layouts", "cookies"],
  mode: "server",
  show: ["src/routes/(app)/_layout.tsx", "src/routes/(app)/dashboard.tsx", "src/session.server.ts", "src/routes/login.tsx"],
});
