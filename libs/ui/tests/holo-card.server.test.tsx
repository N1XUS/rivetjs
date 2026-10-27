// Server-target suite: HoloCard (Rivet addition, feature set inspired by HeroUI Pro's public Holo Card docs): layer markup, root
// variables from `gradient` / `patternSize` / `parallaxStrength`, static flag, default shine pattern, image; the root's pointer
// handlers visible to the derived model's facts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { moduleFacts } from "@rivetjs/compiler";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { HoloCard } from "../src/components/holo-card/index.ts";

test("holo card SSR: layers and variables", async () => {
  const html = await renderToString(() => (
    <HoloCard gradient="linear-gradient(red, blue)" patternSize="cover" parallaxStrength={4}>
      <HoloCard.Rotator>
        <HoloCard.Frame>
          <HoloCard.Surface>
            <HoloCard.Image alt="Art" src="/a.jpg" />
            <HoloCard.Inset />
            <HoloCard.Pattern />
            <HoloCard.Content parallax={false}>
              <span>Member</span>
            </HoloCard.Content>
            <HoloCard.Shine />
          </HoloCard.Surface>
        </HoloCard.Frame>
      </HoloCard.Rotator>
    </HoloCard>
  ));
  assert.match(html, /class="holo-card"[^>]*data-slot="holo-card"/);
  assert.match(html, /--holo-card-gradient:\s*linear-gradient\(red, blue\)/);
  assert.match(html, /--holo-card-pattern-size:\s*cover/);
  assert.match(html, /--holo-card-parallax:\s*4/);
  for (const part of ["rotator", "frame", "surface", "inset", "pattern", "shine", "shine-pattern"])
    assert.match(html, new RegExp(`class="holo-card__${part}"`));
  assert.match(html, /<img class="holo-card__image"[^>]*alt="Art"/);
  assert.match(html, /holo-card__content"[^>]*data-parallax="false"[^>]*><span>Member/);
  assert.doesNotMatch(html, /data-static/);
});

test("holo card SSR: static", async () => {
  const html = await renderToString(() => (
    <HoloCard isInteractive={false}>
      <HoloCard.Rotator>
        <HoloCard.Frame>
          <HoloCard.Surface />
        </HoloCard.Frame>
      </HoloCard.Rotator>
    </HoloCard>
  ));
  assert.match(html, /data-static="true"/);
});

// UI-BUGS 2026-10-27: the root's handlers were hidden in a spread object (`{ ...rest, ...(isStatic ? {} : { onPointerMove }) }`),
// so the derived build saw no change source: no boundary, no loader, and on a page with no other boundary (a docs example
// frame) the card never tilted. JSX handler attributes make it a listener (`COND` boundary kept per interactive instance).
test("holo card facts: the root listens (its pointer handlers resume it)", () => {
  const file = fileURLToPath(new URL("../src/components/holo-card/holo-card.tsx", import.meta.url));
  const root = moduleFacts(readFileSync(file, "utf8"), file, { boundaries: true }).boundaries.get("HoloCardRoot");
  assert.ok(root, "HoloCardRoot facts");
  assert.ok(root.source || root.listens, "HoloCardRoot has a change source or a conditional listener");
});
