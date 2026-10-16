import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Login form",
  summary: "A sign-in form handled by a server action: it checks a hashed password, sets an HttpOnly session cookie and redirects.",
  tags: ["routing", "actions", "forms", "cookies"],
  mode: "server",
  show: ["src/routes/login.tsx", "src/auth.server.ts", "src/routes/index.tsx"],
});
