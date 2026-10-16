import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form server errors",
  summary: "validationErrors on a Form: server errors per field name, shown on the fields from the first render and applied as custom validity on submit.",
  tags: ["form", "validation", "server"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#se-user", "aria-invalid", "true"] },
    { expect: ["#se-user-error", "That username is taken."] },
    { described: ["#se-user", "That username is taken."] },
    { attr: ["#se-user", "data-rv-error", "That username is taken."] },
    { attr: ["#se-plan", "aria-invalid", "true"] },
    { described: ["#se-plan", "Pick a paid plan for teams."] },
    // Fields whose name has no error stay valid.
    { attr: ["#se-email", "aria-invalid", null] },
    { absent: "#se-email-error" },
  ],
});
