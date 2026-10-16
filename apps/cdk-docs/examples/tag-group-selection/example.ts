import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup selection",
  summary: "Controlled multiple selection through a selectedKeys signal; disabledKeys and isDisabled tags are skipped and cannot be selected.",
  tags: ["tag-group", "selection", "controlled"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#amenities [data-key=fitness]", "aria-selected", "true"] },
    // Disabled tags cannot be selected: no aria-selected at all.
    { attr: ["#amenities [data-key=parking]", "aria-disabled", "true"] },
    { attr: ["#amenities [data-key=parking]", "aria-selected", null] },
    { attr: ["#amenities [data-key=breakfast]", "aria-disabled", "true"] },
    { attr: ["#amenities [data-key=breakfast]", "tabindex", "-1"] },
    { click: "#amenities [data-key=laundry]" },
    { expect: ["#amenities-value", "Current selection: fitness, laundry"] },
    { key: "ArrowRight" },
    { key: "ArrowRight" },
    // Parking is disabled: skipped.
    { focused: "#amenities [data-key=pool]" },
    { key: "Space" },
    { expect: ["#amenities-value", "Current selection: fitness, laundry, pool"] },
    // Breakfast is disabled: focus wraps to the first tag.
    { key: "ArrowRight" },
    { focused: "#amenities [data-key=laundry]" },
    { click: "#amenities-clear" },
    { attr: ["#amenities [data-key=laundry]", "aria-selected", "false"] },
    { expect: ["#amenities-value", "Current selection:"] },
  ],
});
