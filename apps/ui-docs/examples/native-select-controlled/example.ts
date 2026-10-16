import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: Controlled",
  summary: "A two-way value signal: the select writes the picked value, a button outside writes it back.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#zone", "utc"] }, { click: "button" }, { expect: ["#zone", "jst"] }, { matches: "option[value=jst]:checked" }],
});
