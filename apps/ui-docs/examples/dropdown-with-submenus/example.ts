import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dropdown: With Submenus",
  summary: 'Dropdown demo "With Submenus".',
  tags: ["dropdown"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button[aria-label=Menu]" }, { click: "[data-key=share]" }, { expect: ["[role=menu] [data-key=whatsapp]", "WhatsApp"] }],
});
