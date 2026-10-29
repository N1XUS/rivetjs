import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: PR File Review",
  summary:
    "A code review file tree: change status, +/− line counts and comment counts per file, a viewed toggle, and the selected file's diff summary beside the tree.",
  tags: ["file-tree"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#ft-review-path", "src/components/prompt-input.tsx"] },
    { expect: ["#ft-review-progress", "1 of 7 viewed"] },
    // Selecting a renamed file shows where it came from.
    { click: "#ft-review [role=row][data-key=use-tokens]" },
    { attr: ["#ft-review [role=row][data-key=use-tokens]", "aria-selected", "true"] },
    { expect: ["#ft-review-change", "Renamed from src/use-tags.ts"] },
    { expect: ["#ft-review-stat", "+9 −7"] },
    // Marking it viewed updates the row and the progress.
    { click: "#ft-review-detail [data-slot=checkbox-content]" },
    { matches: "#ft-review [role=row][data-key=use-tokens] [data-viewed=true]" },
    { expect: ["#ft-review-progress", "2 of 7 viewed"] },
    // A folder sums its files; collapsing it hides its rows.
    { click: "#ft-review [role=row][data-key=components]" },
    { expect: ["#ft-review-change", "Folder, 3 changed files"] },
    { expect: ["#ft-review-stat", "+134 −66"] },
    { click: "#ft-review [role=row][data-key=components] [slot=chevron]" },
    { absent: "#ft-review [role=row][data-key=token-chip]" },
  ],
});
