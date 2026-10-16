import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Guard with login",
  summary: "A layout guard sends visitors without a session cookie to a login page, then back where they started.",
  tags: ["routing", "guards", "cookies"],
  mode: "server",
  show: ["src/routes/(private)/_layout.tsx", "src/routes/login.tsx", "src/routes/(private)/account.tsx", "src/sessions.server.ts"],
});
