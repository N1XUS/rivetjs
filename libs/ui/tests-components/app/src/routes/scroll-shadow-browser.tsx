// Fixtures of the ported upstream `scroll-shadow.browser.test.tsx` (HeroUI v3.2.6) on a resumed page, one instance per upstream
// fixture (size 40, viewport 240px): `#sb-over` Overflowing (1200px tall), `#sb-offset` Overflowing `offset=80`, `#sb-fit`
// Fitting, `#sb-row` OverflowingRow (no dir), `#sb-row-ltr` / `#sb-row-rtl` inside `dir` wrappers (rtl + `lang="ar"`, see the note), `#sb-row-fit` FittingRow,
// `#sb-off` detection disabled, `#sb-both` controlled `visibility="both"`.
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";

export const head = { title: "ScrollShadow (browser)" };

const SIZE = 40;

export default function ScrollShadowBrowserStories() {
  return (
    <main>
      <ScrollShadow id="sb-over" size={SIZE} style={{ height: "240px" }}>
        <div style={{ height: "1200px" }}>Tall content</div>
      </ScrollShadow>
      <ScrollShadow id="sb-offset" offset={80} size={SIZE} style={{ height: "240px" }}>
        <div style={{ height: "1200px" }}>Tall content</div>
      </ScrollShadow>
      <ScrollShadow id="sb-fit" size={SIZE} style={{ height: "240px" }}>
        <div>Short content</div>
      </ScrollShadow>
      <div>
        <ScrollShadow id="sb-row" orientation="horizontal" size={SIZE} style={{ width: "240px" }}>
          <div style={{ width: "1200px" }}>Wide content</div>
        </ScrollShadow>
      </div>
      <div dir="ltr">
        <ScrollShadow id="sb-row-ltr" orientation="horizontal" size={SIZE} style={{ width: "240px" }}>
          <div style={{ width: "1200px" }}>Wide content</div>
        </ScrollShadow>
      </div>
      {/* `lang` too: Tailwind v4's build optimizer (Lightning CSS, targets Chrome 111 / Safari 16.4) lowers the vendored
          `&:dir(rtl)` rule to `:is(:lang(ar), :lang(he), …)`, so `dir="rtl"` alone does not match in a production build. */}
      <div dir="rtl" lang="ar">
        <ScrollShadow id="sb-row-rtl" orientation="horizontal" size={SIZE} style={{ width: "240px" }}>
          <div style={{ width: "1200px" }}>Wide content</div>
        </ScrollShadow>
      </div>
      <ScrollShadow id="sb-row-fit" orientation="horizontal" size={SIZE} style={{ width: "240px" }}>
        <div style={{ width: "20px" }}>Narrow</div>
      </ScrollShadow>
      <ScrollShadow id="sb-off" isEnabled={false} size={SIZE} style={{ height: "240px" }}>
        <div style={{ height: "1200px" }}>Tall content</div>
      </ScrollShadow>
      <ScrollShadow id="sb-both" size={SIZE} visibility="both">
        <div>Short content</div>
      </ScrollShadow>
    </main>
  );
}
