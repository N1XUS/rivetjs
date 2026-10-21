import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu DOM events and attributes",
  summary: "Global DOM events and attributes go on each part: the trigger Button, the Menu (role=menu) and each MenuItem.",
  tags: ["menu", "events", "dom"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#d-trigger", "lang", "en"] },
    { click: "#d-trigger" },
    // The trigger's own press handler opened the menu at pointerdown; your pointerenter ran too. The release lands on
    // the open popover, not the trigger, so the trigger gets no click (as upstream; a cold press replays the same).
    { matches: "#d[role=menu]" },
    { expect: ["#d-log", "trigger-enter"] },
    { attr: ["#d", "lang", "pt"] },
    { attr: ["#d", "dir", "ltr"] },
    { attr: ['#d [data-key="paste"]', "lang", "nl"] },
    { click: '#d [data-key="copy"]' },
    { expect: ["#d-log", "trigger-enter menu-enter copy-down menu-click"] },
    { expect: ["#d-action", "copy"] },
    { absent: "#d" },
  ],
});
