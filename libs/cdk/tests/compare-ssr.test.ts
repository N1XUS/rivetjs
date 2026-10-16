// Server rendering (resume mode) of the Rivet-authored `@rivetjs/cdk/compare`: root / layers / handle markup with the
// behaviour styles inline (after layer clipped by `clip-path: inset(…)`, handle at the value), slider ARIA, vertical +
// RTL insets, and the whole tree serializes (every handler / binding capture is resumable: render throws otherwise).
import { describe, expect, it } from "vitest";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { Compare, CompareAfter, CompareBefore, CompareDivider, CompareHandle } from "@rivetjs/cdk/compare";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { signal } from "@rivetjs/reactivity";

export function Basic() {
  const value = signal(30);
  return (
    <Compare id="c" value={value} onChangeEnd={(v) => console.info(v)}>
      <CompareBefore>Before</CompareBefore>
      <CompareAfter>After</CompareAfter>
      <CompareHandle><CompareDivider /></CompareHandle>
    </Compare>
  );
}

export function Vertical() {
  return (
    <Compare defaultValue={25} orientation="vertical" dragAnywhere isDisabled>
      <CompareBefore>Before</CompareBefore>
      <CompareAfter>After</CompareAfter>
      <CompareHandle aria-label="Split" />
    </Compare>
  );
}

export function Rtl() {
  return (
    <I18nProvider locale="ar-EG">
      <Compare defaultValue={40}>
        <CompareBefore>Before</CompareBefore>
        <CompareAfter>After</CompareAfter>
        <CompareHandle />
      </Compare>
    </I18nProvider>
  );
}
`;

type Fixture = { Basic(): unknown; Vertical(): unknown; Rtl(): unknown };
const load = () => importModule<Fixture>("compare-ssr-fixture.tsx", source);

describe("Compare SSR", () => {
  it("renders the layers, the clipped after layer and the slider handle at the value", async () => {
    const { Basic } = await load();
    const html = await renderHtml(() => Basic());
    const root = /<div[^>]*data-rv-compare=""[^>]*>/.exec(html)?.[0] ?? "";
    expect(root).toMatch(/class="rv-Compare"/);
    expect(root).toMatch(/data-orientation="horizontal"/);
    expect(root).toMatch(/position:relative/);
    expect(root).toMatch(/overflow:hidden/);
    expect(root).toMatch(/--rv-compare-position:30%/);
    expect(root).not.toMatch(/touch-action/);
    expect(html).toMatch(/class="rv-CompareBefore"[^>]*data-rv-compare-before=""/);
    const after = /<div[^>]*data-rv-compare-after=""[^>]*>/.exec(html)?.[0] ?? "";
    expect(after).toMatch(/position:absolute/);
    expect(after).toMatch(/clip-path:inset\(0 0 0 30%\)/);
    const handle = /<div[^>]*role="slider"[^>]*>/.exec(html)?.[0] ?? "";
    expect(handle).toMatch(/class="rv-CompareHandle"/);
    expect(handle).toMatch(/tabindex="0"/);
    expect(handle).toMatch(/aria-label="Comparison position"/);
    expect(handle).toMatch(/aria-orientation="horizontal"/);
    expect(handle).toMatch(/aria-valuemin="0"/);
    expect(handle).toMatch(/aria-valuemax="100"/);
    expect(handle).toMatch(/aria-valuenow="30"/);
    expect(handle).toMatch(/aria-valuetext="30%"/);
    expect(handle).toMatch(/left:30%/);
    expect(handle).toMatch(/transform:translateX\(-50%\)/);
    expect(handle).toMatch(/touch-action:none/);
    expect(html).toMatch(/<span[^>]*class="rv-CompareDivider"[^>]*aria-hidden="true"/);
  });

  it("vertical: top inset, disabled handle, surface gestures", async () => {
    const { Vertical } = await load();
    const html = await renderHtml(() => Vertical());
    expect(html).toMatch(/data-rv-compare=""[^>]*data-disabled="true"|data-disabled="true"[^>]*data-rv-compare=""/);
    expect(html).toMatch(/touch-action:pan-x/);
    expect(html).toMatch(/clip-path:inset\(25% 0 0 0\)/);
    const handle = /<div[^>]*role="slider"[^>]*>/.exec(html)?.[0] ?? "";
    expect(handle).toMatch(/aria-label="Split"/);
    expect(handle).toMatch(/aria-orientation="vertical"/);
    expect(handle).toMatch(/aria-disabled="true"/);
    expect(handle).not.toMatch(/tabindex=/);
    expect(handle).toMatch(/top:25%/);
  });

  it("RTL locale: the before layer starts on the right", async () => {
    const { Rtl } = await load();
    const html = await renderHtml(() => Rtl());
    expect(html).toMatch(/clip-path:inset\(0 40% 0 0\)/);
    const handle = /<div[^>]*role="slider"[^>]*>/.exec(html)?.[0] ?? "";
    expect(handle).toMatch(/right:40%/);
    expect(handle).toMatch(/translateX\(50%\)/);
  });
});
