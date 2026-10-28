import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover trigger modes",
  summary: 'DialogTrigger trigger="hover" | "focus" | "longPress": hover or keyboard focus, keyboard focus only, or a long press opens the popover.',
  tags: ["popover", "hover", "focus", "long-press"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: "#hover-card" },
    // Keyboard focus opens a hover trigger (no hover needed); Escape restores focus to the trigger without reopening it.
    { key: "Tab" },
    { matches: "#hover-card" },
    { key: "Escape" },
    { absent: "#hover-card" },
    { focused: "#hover-trigger" },
    // Focus coming back by keyboard opens it again; an outside press closes it.
    { key: "Shift+Tab" },
    { key: "Tab" },
    { matches: "#hover-card" },
    { click: "body" },
    { absent: "#hover-card" },
    // A press still toggles a focus trigger.
    { click: "#focus-trigger" },
    { matches: "#focus-card" },
    { click: "body" },
    { absent: "#focus-card" },
    // longPress: the description is announced; Enter still opens.
    { described: ["#long-trigger", "Long press to see versions"] },
    { press: ["#long-trigger", "Enter"] },
    { matches: "#long-card" },
    // The popover's dialog takes focus a frame after it mounts: Escape goes to the focused dialog.
    { focused: "#long-card" },
    { key: "Escape" },
    { absent: "#long-card" },
  ],
});
