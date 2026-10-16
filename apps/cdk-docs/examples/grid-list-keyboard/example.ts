import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList: keyboard navigation",
  summary: 'keyboardNavigationBehavior="tab": Tab moves into a row\'s text field; arrow keys and typing inside it stay in the field.',
  tags: ["grid-list", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#shared-sunset", "ArrowDown"] },
    { focused: "#shared-trail" },
    { key: "Tab" },
    { focused: "#shared-trail input" },
    // Typing and arrows stay in the field: no typeahead, no row navigation, no selection.
    { key: "ArrowLeft" },
    { key: "End" },
    { key: "s" },
    { focused: "#shared-trail input" },
    { attr: ["#shared-trail", "aria-selected", "false"] },
  ],
});
