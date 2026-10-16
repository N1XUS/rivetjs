import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Contact form",
  summary: "A form built with @rivetjs/forms: checked in the browser once used, checked again by the server action, and working without JavaScript.",
  tags: ["forms", "actions", "validation"],
  status: "experimental",
  mode: "server",
  show: ["src/forms/contact.ts", "src/routes/index.tsx"],
});
