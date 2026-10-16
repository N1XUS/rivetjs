import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs overflow",
  summary: 'overflowMode="collapse": breadcrumbs that do not fit collapse into a "…" MenuTrigger after the root; resize the box (drag its corner).',
  tags: ["breadcrumbs", "overflow", "menu"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // 320px box: Files + "…" + the last two folders.
    { matches: "#folder-trail > li[data-overflow] button[aria-label='More folders']" },
    { attr: ["#folder-trail > li:last-child", "data-current", "true"] },
    { click: "#folder-trail button[aria-label='More folders']" },
    { matches: "#folder-menu [role=menuitem][data-key='photos']" },
    { click: "#folder-menu [role=menuitem][data-key='photos']" },
    { absent: "#folder-menu" },
    // Picking a collapsed folder navigates up: the trail is short enough to show every item again.
    { expect: ["#folder-trail > li:last-child", "Photos"] },
    { absent: "#folder-trail > li[data-overflow]" },
  ],
});
