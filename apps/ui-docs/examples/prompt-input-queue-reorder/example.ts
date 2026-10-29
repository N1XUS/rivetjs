import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Reorder Queue",
  summary: "Queued prompts reorder by drag (or Alt+Arrow keys): PromptInputQueueReorder.List values + onReorder.",
  tags: ["prompt-input", "drag and drop"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: [".prompt-input__queue-list", "data-reorderable", "true"] },
    { expect: [".prompt-input__queue-item:first-child", "Now add error handling"] },
    // Cold keyboard move (first input): Alt+ArrowDown moves the focused row down by one, focus stays on it.
    { press: [".prompt-input__queue-item:first-child", "Alt+ArrowDown"] },
    { expect: [".prompt-input__queue-item:nth-child(2)", "Now add error handling"] },
    { focused: ".prompt-input__queue-item:nth-child(2)" },
    { expect: ["#queue-order", "2, 1, 3"] },
    { key: "Alt+ArrowDown" },
    { expect: [".prompt-input__queue-item:last-child", "Now add error handling"] },
    { expect: ["#queue-order", "2, 3, 1"] },
    // Pointer drags: story `/prompt-input-queue-reorder` (`libs/ui/tests-components/prompt-input-queue-reorder.test.ts`,
    // stepped mouse moves; a one-move drag never sorts a cdk drop list).
  ],
});
