import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "List with nextIndex and typeahead",
  summary: "A vertical list from nextIndex and typeahead: no wrap, PageUp and PageDown by 3, a disabled item skipped, letters jump to matching items.",
  tags: ["keyboard", "typeahead"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#countries", "data-rk", "ArrowDown ArrowUp Home End PageUp PageDown"] },
    { press: ["#c-austria", "ArrowDown"] },
    { focused: "#c-belgium" },
    // Croatia is disabled: skipped.
    { key: "ArrowDown" },
    { focused: "#c-cyprus" },
    { key: "PageDown" },
    { focused: "#c-finland" },
    { key: "End" },
    { focused: "#c-italy" },
    // No wrap: the last item stays focused.
    { key: "ArrowDown" },
    { focused: "#c-italy" },
    { key: "PageUp" },
    { focused: "#c-finland" },
    { key: "Home" },
    { focused: "#c-austria" },
    // Typeahead: letters typed within 750 ms build a prefix.
    { key: "f" },
    { focused: "#c-finland" },
    { key: "r" },
    { focused: "#c-france" },
    { key: "Home" },
    { focused: "#c-austria" },
  ],
});
