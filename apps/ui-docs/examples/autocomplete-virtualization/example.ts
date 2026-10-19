import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Autocomplete: Virtualization",
  summary: 'Autocomplete demo "Virtualization".',
  tags: ["autocomplete"],
  status: "experimental",
  frame: { height: 440 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=autocomplete-trigger]" },
    // The popover ListBox renders a window of the 1000 users (52px rows), not every option.
    { matches: "[data-slot=autocomplete-popover] [role=option][data-key='1']" },
    { absent: "[data-slot=autocomplete-popover] [role=option][data-key='100']" },
    { wheel: ["[data-slot=autocomplete-popover] [role=listbox]", 2600] },
    { matches: "[data-slot=autocomplete-popover] [role=option][data-key='52']" },
    { absent: "[data-slot=autocomplete-popover] [role=option][data-key='1']" },
    { click: "[data-slot=autocomplete-popover] [role=option][data-key='52']" },
    { expect: ["[data-slot=autocomplete-value]", "Ethan Williams"] },
    // Filtering re-windows the list: "Olivia Jones" matches users 83, 243, 403, 563, 723 and 883.
    { click: "[data-slot=autocomplete-trigger]" },
    { fill: ["[data-slot=autocomplete-popover] input", "Olivia Jones"] },
    { matches: "[data-slot=autocomplete-popover] [role=option][data-key='83']" },
    { absent: "[data-slot=autocomplete-popover] [role=option][data-key='2']" },
    // The popover fits the frame: the last match is below the list's visible rows until it scrolls.
    { wheel: ["[data-slot=autocomplete-popover] [role=listbox]", 400] },
    { matches: "[data-slot=autocomplete-popover] [role=option][data-key='883']" },
    { click: "[data-slot=autocomplete-popover] [role=option][data-key='883']" },
    { expect: ["[data-slot=autocomplete-value]", "Olivia Jones"] },
  ],
});
