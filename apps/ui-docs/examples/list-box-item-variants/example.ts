import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBoxItem: Variants and States",
  summary:
    "ListBoxItem in a multiple-selection ListBox: a render function that reads isSelected, a disabled option, the danger variant and the selection indicator.",
  tags: ["list-box", "list-box-item", "selection"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ['#lbi-channels [data-key="email"]', "On: daily digest"] },
    { attr: ['#lbi-channels [data-key="sms"]', "aria-disabled", "true"] },
    { click: '#lbi-channels [data-key="push"]' },
    { attr: ['#lbi-channels [data-key="push"]', "aria-selected", "true"] },
    { expect: ["#lbi-count", "2 selected"] },
    { click: '#lbi-channels [data-key="email"]' },
    { expect: ['#lbi-channels [data-key="email"]', "Off"] },
    { expect: ["#lbi-count", "1 selected"] },
    { key: "ArrowDown" },
    { focused: '#lbi-channels [data-key="push"]' },
    { key: "ArrowDown" },
    { focused: '#lbi-channels [data-key="all-off"]' },
  ],
});
