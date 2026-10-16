import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: forms",
  summary: "startName / endName post both ends; read-only ranges are submitted, disabled ones are not; a form reset restores defaultValue.",
  tags: ["aria", "date", "forms"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/components/RangePickerParts.tsx", "src/styles.css"],
  test: [
    { attr: ["#stay-start-input", "name", "checkin"] },
    { attr: ["#stay-end-input", "required", ""] },
    { attr: ["#fixed-button", "disabled", ""] },
    { attr: ["#off-start-day", "aria-disabled", "true"] },
    { press: ["#stay-end-day", "ArrowUp"] },
    { click: "#submit" },
    { expect: ["#value", "Submitted: checkin=2026-10-14&checkout=2026-10-19&from=2026-06-01&to=2026-08-31"] },
    { click: "#reset" },
    { expect: ["#stay-end", "10/18/2026"] },
  ],
});
