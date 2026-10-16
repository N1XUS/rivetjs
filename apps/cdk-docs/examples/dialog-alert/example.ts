import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Alert dialog",
  summary:
    'role=alertdialog with a title and a description (aria-describedby), a Heading slot="title" and a Text slot="description", two actions from the close render prop; Escape still closes, an outside click never does.',
  tags: ["dialog", "alertdialog"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#delete-trigger" },
    { attr: ["#delete", "role", "alertdialog"] },
    { name: ["#delete", "Delete the file?"] },
    { described: ["#delete", "This cannot be undone."] },
    // No [autofocus]: the dialog itself takes focus; Tab cycles Cancel → Delete → Cancel.
    { focused: "#delete" },
    { key: "Tab" },
    { focused: "#delete-cancel" },
    { key: "Tab" },
    { focused: "#delete-confirm" },
    { key: "Tab" },
    { focused: "#delete-cancel" },
    { key: "Enter" },
    { absent: "#delete" },
    { expect: ["#delete-status", "Kept"] },
    { focused: "#delete-trigger" },
    { key: "Enter" },
    { matches: "#delete" },
    { click: "#delete-confirm" },
    { absent: "#delete" },
    { expect: ["#delete-status", "Deleted"] },
    { key: "Enter" },
    { matches: "#delete" },
    // Every reopen renders the whole content again (description and buttons, not only the title).
    { described: ["#delete", "This cannot be undone."] },
    { matches: "#delete-confirm" },
    { key: "Escape" },
    { absent: "#delete" },
  ],
});
