import { Inline } from "./Inline.tsx";

/** What `::api{symbol}` inlines at content generation (`tools/content/markdown.ts`): the card renders in the browser too (client navigation), where `virtual:docs/api` is empty. */
export interface ApiCardData {
  name: string;
  kind: string;
  entry: string;
  href: string;
  summary: string;
  signature?: string;
  /** Resolved `RUNS_ON` label. */
  runs: string;
}

/** `::api{symbol="@rivetjs/pkg/entry#name"}` in Markdown: summary, signature and a link to the full entry. */
export function ApiCard({ card }: { card: ApiCardData }) {
  return (
    <section class="api-card not-prose" aria-label={"API: " + card.name}>
      <p class="api-card-head">
        <a href={card.href} data-rivet-reload="">
          <code>{card.name}</code>
        </a>
        <span class="api-kind">{card.kind}</span>
        <span class="api-entry">
          from <code>{card.entry}</code>
        </span>
      </p>
      {card.summary ? (
        <p class="api-card-summary">
          <Inline text={card.summary} />
        </p>
      ) : null}
      {card.signature ? <pre class="api-signature">{card.signature}</pre> : null}
      <p class="api-card-foot">
        <span class="runs-on">{card.runs}</span>
        <a href={card.href} data-rivet-reload="">
          Full reference
        </a>
      </p>
    </section>
  );
}
