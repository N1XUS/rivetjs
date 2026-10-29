// Server-target suite: root hooks render their SSR defaults (nothing runs on the server): mounted / hydrated false, media query =
// defaultValue, measured height 0, theme choice "system" resolving light.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { useIsHydrated, useMeasuredHeight, useMediaQuery, useMounted, useSafeLayoutEffect, useTheme } from "../index.ts";

test("hooks on the server: SSR defaults, effects never run", async () => {
  let ran = false;
  const Probe = () => {
    const mounted = useMounted();
    const hydrated = useIsHydrated();
    const wide = useMediaQuery("(min-width: 600px)");
    const wideDefault = useMediaQuery("(min-width: 600px)", true);
    const h = useMeasuredHeight(() => null);
    const theme = useTheme();
    useSafeLayoutEffect(() => {
      ran = true;
    });
    return (
      <p>
        {String(mounted())}|{String(hydrated())}|{String(wide())}|{String(wideDefault())}|{String(h())}|{theme.theme()}|{theme.resolvedTheme()}
      </p>
    );
  };
  const html = await renderToString(() => <Probe />);
  assert.match(html, /false\|false\|false\|true\|0\|system\|light/);
  assert.equal(ran, false);
});
