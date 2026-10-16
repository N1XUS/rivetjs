import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover with a custom trigger",
  summary: "DialogTrigger with a Pressable child: a span with role=button gets the press handling, tab stop and aria-expanded of the trigger.",
  tags: ["popover", "pressable", "custom"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#ct-trigger", "aria-expanded", "false"] },
    { attr: ["#ct-trigger", "tabindex", "0"] },
    { click: "#ct-trigger" },
    { matches: "#ct" },
    { attr: ["#ct-trigger", "aria-expanded", "true"] },
    { key: "Escape" },
    { absent: "#ct" },
    { focused: "#ct-trigger" },
    { key: "Enter" },
    { matches: "#ct" },
  ],
});
