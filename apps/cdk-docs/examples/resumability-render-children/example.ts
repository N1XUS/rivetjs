import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Render-function children",
  summary: "A Dialog in a Popover whose content holds components, passed as a render function: they are created on open and use the close render prop.",
  tags: ["resumability", "popover", "slots"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Closed: the content is not in the server HTML.
    { absent: "#filters" },
    { absent: "#only-open" },
    { click: "#filters-trigger" },
    { matches: "#filters[role=dialog]" },
    { attr: ["#only-open", "aria-pressed", "false"] },
    { click: "#only-open" },
    { attr: ["#only-open", "aria-pressed", "true"] },
    { expect: ["#value", "Only open issues: yes"] },
    { click: "#done" },
    { absent: "#filters" },
    { focused: "#filters-trigger" },
    // Reopened: the toggle reads the shared signal.
    { click: "#filters-trigger" },
    { attr: ["#only-open", "aria-pressed", "true"] },
    { key: "Escape" },
    { absent: "#filters" },
  ],
});
