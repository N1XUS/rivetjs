import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup options",
  summary: "A CheckboxGroup with one disabled checkbox, a disabled group and a read-only group whose checkboxes keep their values.",
  tags: ["checkbox-group", "disabled", "read-only"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#days input[value='sun']", "disabled", ""] },
    { matches: "#days label[data-disabled]:has(input[value='sun'])" },
    { attr: ["#off", "aria-disabled", "true"] },
    { attr: ["#off", "data-disabled", "true"] },
    { attr: ["#off input[value='a']", "disabled", ""] },
    { attr: ["#fixed", "data-readonly", "true"] },
    { attr: ["#fixed input[value='a']", "aria-readonly", "true"] },
    { click: "#fixed label:has(input[value='b'])" },
    { matches: "#fixed input[value='b']:not(:checked)" },
    { click: "#days label:has(input[value='mon'])" },
    { matches: "#days input[value='mon']:checked" },
  ],
});
