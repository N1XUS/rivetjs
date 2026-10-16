import { RUNS_ON, symbolByKey } from "../api.ts";
import { Inline } from "./Inline.tsx";

/** `::api{symbol="@rivetjs/pkg/entry#name"}` in Markdown: summary, signature and a link to the full entry. */
export function ApiCard({ symbol }: { symbol: string }) {
  const found = symbolByKey(symbol);
  if (!found) throw new Error(`ApiCard: unknown symbol ${symbol}`);
  return (
    <section class="api-card not-prose" aria-label={"API: " + found.name}>
      <p class="api-card-head">
        <a href={found.href} data-rivet-reload="">
          <code>{found.name}</code>
        </a>
        <span class="api-kind">{found.kind}</span>
        <span class="api-entry">
          from <code>{found.entry}</code>
        </span>
      </p>
      {found.summary ? (
        <p class="api-card-summary">
          <Inline text={found.summary} />
        </p>
      ) : null}
      {found.signatures.length ? <pre class="api-signature">{found.signatures[0]}</pre> : null}
      <p class="api-card-foot">
        <span class="runs-on">{RUNS_ON[found.runsOn]}</span>
        <a href={found.href} data-rivet-reload="">
          Full reference
        </a>
      </p>
    </section>
  );
}
