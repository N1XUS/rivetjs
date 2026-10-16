import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FocusKeyManager",
  summary: "Angular CDK's FocusKeyManager over DOM items: wrap, Home and End, typeahead, a custom skipPredicate, the change and tabOut streams.",
  tags: ["keyboard", "key-manager", "focus"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#fk-apple", "tabindex", "0"] },
    { attr: ["#fk-banana", "tabindex", "-1"] },
    { press: ["#fk-apple", "ArrowDown"] },
    { focused: "#fk-banana" },
    { attr: ["#fk-banana", "tabindex", "0"] },
    { attr: ["#fk-apple", "tabindex", "-1"] },
    { expect: ["#fk-active", "1"] },
    // Cherry is aria-disabled, Date is sold out: the skip predicate skips both.
    { key: "ArrowDown" },
    { focused: "#fk-elderberry" },
    // withWrap: past the last item back to the first.
    { key: "ArrowDown" },
    { focused: "#fk-apple" },
    { key: "ArrowUp" },
    { focused: "#fk-elderberry" },
    { key: "Home" },
    { focused: "#fk-apple" },
    { key: "End" },
    { focused: "#fk-elderberry" },
    // withTypeAhead: letters, debounced, activate the next match.
    { key: "b" },
    { focused: "#fk-banana" },
    { expect: ["#fk-active", "1"] },
    { key: "Tab" },
    { expect: ["#fk-log", "tabOut"] },
  ],
});
