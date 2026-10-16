import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form with Tailwind",
  summary: "A Form laid out and styled with Tailwind: has-[[data-invalid]]: on the form, user-invalid: and group-data-[invalid]: on the fields.",
  tags: ["form", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "form#tw-form.grid" },
    { matches: "#tw-form .group[data-invalid]:has(> #tw-slug)" },
    { expect: ["#tw-slug-error", "Slug already in use."] },
    { fill: ["#tw-title", "Launch"] },
  ],
});
