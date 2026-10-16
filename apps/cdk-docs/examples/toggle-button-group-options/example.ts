import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup options",
  summary: 'disallowEmptySelection keeps one button on, orientation="vertical" switches the arrow keys to Up / Down, isDisabled disables every button.',
  tags: ["toggle-button-group", "options"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { click: "#align button:nth-child(1)" },
    { attr: ["#align button:nth-child(1)", "aria-checked", "true"] },
    { attr: ["#size", "aria-orientation", "vertical"] },
    { attr: ["#size", "data-orientation", "vertical"] },
    { press: ["#size button:nth-child(1)", "ArrowDown"] },
    { focused: "#size button:nth-child(2)" },
    { attr: ["#locked", "data-disabled", "true"] },
    { attr: ["#locked", "aria-disabled", "true"] },
    { attr: ["#locked button:nth-child(2)", "disabled", ""] },
  ],
});
