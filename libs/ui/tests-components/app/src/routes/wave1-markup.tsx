// Plan 2 wave 1 T10–T13 components only (no Button / Link / TextField handlers): the resumed page must request no ui / route JS
// before an interaction (`harness.ts` `RUNTIME_ENTRY` allowlist).
import { Markup } from "../wave1-markup.tsx";

export const head = { title: "Wave 1 markup" };

export default function Wave1MarkupStories() {
  return (
    <main>
      <section id="w-static">
        <Markup n={-1} />
      </section>
    </main>
  );
}
