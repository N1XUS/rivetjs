import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Group state and role",
  summary:
    "isDisabled, isInvalid and isReadOnly render data attributes for styling; aria-disabled / aria-invalid add the ARIA states; role region or presentation.",
  tags: ["group", "state"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#g-off", "data-disabled", "true"] },
    { attr: ["#g-off", "aria-disabled", null] },
    { attr: ["#g-aria-off", "aria-disabled", "true"] },
    { attr: ["#g-aria-off", "data-disabled", "true"] },
    { attr: ["#g-bad", "data-invalid", "true"] },
    { attr: ["#g-bad", "aria-invalid", "true"] },
    { attr: ["#g-ro", "data-readonly", "true"] },
    { attr: ["#g-region", "role", "region"] },
    { name: ["#g-region", "Filters"] },
    { attr: ["#g-plain", "role", "presentation"] },
  ],
});
