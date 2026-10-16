import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Head tags per route",
  summary: "A layout sets a title template and default meta tags; a page builds its title, description and canonical link from loader data.",
  tags: ["routing", "head", "seo"],
  frame: { height: "xs" },
  show: ["src/routes/posts/[slug].tsx", "src/routes/_layout.tsx", "src/routes/index.tsx"],
  test: [
    { expect: ["title", "Home · Acme"] },
    { attr: ['meta[name="description"]', "content", "Acme makes tools for small teams."] },
    { click: "#post-hello" },
    { expect: ["#heading", "Hello"] },
    { expect: ["title", "Hello · Acme"] },
    { click: "#post-pricing" },
    { expect: ["#heading", "Pricing"] },
    { expect: ["title", "Pricing · Acme"] },
  ],
});
