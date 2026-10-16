import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup removal",
  summary: "onRemove with createListData: a remove button per tag, Delete / Backspace remove the focused tag or the selection, an empty state.",
  tags: ["tag-group", "remove", "data"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#removable [data-key=news]", "data-allows-removing", "true"] },
    { matches: "#removable [data-key=news] button svg" },
    // The remove button is labelled by itself and its tag ("Remove News"): aria-labelledby="<button id> <row id>".
    { attr: ["#removable [data-key=news] button", "aria-label", "Remove"] },
    { matches: '#removable [data-key=news] button[aria-labelledby$="-news"]' },
    { click: "#removable [data-key=gaming] button" },
    { absent: "#removable [data-key=gaming]" },
    { press: ["#removable [data-key=travel]", "Delete"] },
    { absent: "#removable [data-key=travel]" },
    // Focus moves to the next tag.
    { focused: "#removable [data-key=shopping]" },
    // Delete on a selected tag removes the whole selection.
    { click: "#removable [data-key=news]" },
    { click: "#removable [data-key=shopping]" },
    { attr: ["#removable [data-key=shopping]", "aria-selected", "true"] },
    { key: "Backspace" },
    { absent: "#removable [data-key=news]" },
    { absent: "#removable [data-key=shopping]" },
    { expect: ["#removable [role=group]", "No categories"] },
    { attr: ["#removable [role=group]", "data-empty", "true"] },
    { click: "#removable-reset" },
    { attr: ["#removable [role=grid] [data-key=news]", "role", "row"] },
  ],
});
