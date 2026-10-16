import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: forms",
  summary: "name posts the ISO string through a hidden input; form ties a field to a form by id; a form reset restores defaultValue; autoFocus.",
  tags: ["aria", "date", "forms"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // autoFocus: the first segment is focused on load.
    { focused: "#birthday-month" },
    { attr: ["#birthday-month", "aria-required", "true"] },
    { attr: ["#birthday-input", "name", "birthday"] },
    { attr: ["#birthday-input", "required", ""] },
    { attr: ["#remote-input", "form", "signup"] },
    { press: ["#start-day", "ArrowUp"] },
    { expect: ["#start", "10/15/2026"] },
    { click: "#submit" },
    { expect: ["#value", "Submitted: birthday=1999-12-24&start=2026-10-15&remote=2026-12-01"] },
    { click: "#reset" },
    { expect: ["#start", "10/14/2026"] },
    { click: "#submit" },
    { expect: ["#value", "Submitted: birthday=1999-12-24&start=2026-10-14&remote=2026-12-01"] },
  ],
});
