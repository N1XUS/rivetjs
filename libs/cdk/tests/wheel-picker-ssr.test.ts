// Server rendering (resume mode) of the Rivet-authored `@rivetjs/cdk/wheel-picker` + `@rivetjs/cdk/time-wheels`: drum markup
// (spinbutton value / text / range, items positioned around the selected one by inline styles, no measurement) and a
// TimeField with drums serializes (every handler / binding capture is resumable: render throws otherwise).
import { describe, expect, it } from "vitest";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { Wheel, WheelPicker } from "@rivetjs/cdk/wheel-picker";
import { TimeWheels } from "@rivetjs/cdk/time-wheels";
import { TimeField, DateInput, DateSegment } from "@rivetjs/cdk/date-field";

const options = Array.from({ length: 60 }, (_, i) => ({ value: i, label: String(i).padStart(2, "0") }));

export function Drum() {
  return (
    <WheelPicker aria-label="Pick">
      <Wheel options={options} defaultValue={7} loop aria-label="Minute" />
    </WheelPicker>
  );
}

export function Field() {
  return (
    <TimeField aria-label="Time" defaultValue="09:45:00">
      <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      <TimeWheels minuteStep={5} />
    </TimeField>
  );
}
`;

type Fixture = { Drum(): unknown; Field(): unknown };
const load = () => importModule<Fixture>("wheel-picker-ssr-fixture.tsx", source);

describe("Wheel SSR", () => {
  it("renders the spinbutton and the items around the selected value", async () => {
    const { Drum } = await load();
    const html = await renderHtml(() => Drum());
    expect(html).toMatch(/<div[^>]*class="rv-WheelPicker"[^>]*role="group"[^>]*aria-label="Pick"/);
    const drum = /<div[^>]*role="spinbutton"[^>]*>/.exec(html)?.[0] ?? "";
    expect(drum).toMatch(/aria-valuenow="7"/);
    expect(drum).toMatch(/aria-valuetext="07"/);
    expect(drum).toMatch(/aria-valuemin="0"/);
    expect(drum).toMatch(/aria-valuemax="59"/);
    expect(drum).toMatch(/touch-action:none/);
    expect(html).toMatch(/data-index="7"[^>]*data-selected="true"[^>]*style="[^"]*--rv-wheel-offset:0[;"]/);
    // Looped: 59 renders 8 items above 07 would be hidden; 06 sits one item above.
    expect(html).toMatch(/data-index="6"[^>]*style="[^"]*--rv-wheel-offset:-1[;"]/);
    expect(html).toMatch(/data-index="40"[^>]*style="[^"]*visibility:hidden/);
  });

  it("TimeWheels inside a TimeField renders resumably with the field's value", async () => {
    const { Field } = await load();
    const html = await renderHtml(() => Field());
    expect(html).toMatch(/class="rv-TimeWheels"[^>]*role="group"/);
    expect(html).toMatch(/role="spinbutton"[^>]*aria-label="hour"[^>]*aria-valuenow="9"/);
    expect(html).toMatch(/role="spinbutton"[^>]*aria-label="minute"[^>]*aria-valuenow="45"/);
    expect(html).toMatch(/role="spinbutton"[^>]*aria-valuetext="AM"/);
    expect((html.match(/data-rv-wheel-item/g) ?? []).length).toBe(12 + 12 + 2);
  });
});
