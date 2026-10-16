import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "withIdScope and useId",
  summary: "withIdScope gives a subtree its own counter (byte-stable HTML); useId keeps an explicit id and generates one otherwise.",
  tags: ["cdk", "id"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#scoped label", "for", "card-0"] },
    { attr: ["#scoped input", "id", "card-0"] },
    { attr: ["#scoped input", "aria-describedby", "card-1"] },
    { attr: ["#explicit input", "id", "newsletter"] },
    { matches: '#generated input[id^="rv"]' },
  ],
});
