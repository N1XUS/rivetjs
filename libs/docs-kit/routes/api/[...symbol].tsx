import { notFound, type PageProps, type RequestEvent, entries, guard } from "@rivetjs/router";
import type { ApiSymbol } from "@rivetjs/docs-kit/tools/api.ts";
import { apiPaths, entryOf, findApiPage, RUNS_ON, symbolsOf, type ApiEntry } from "@rivetjs/docs-kit/api.ts";
import { site } from "virtual:docs/site";
import { Inline } from "@rivetjs/docs-kit/components/Inline.tsx";
import { TriangleAlert } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

type Params = { symbol: string };

/** Prerender one page per entry point and per export. */
export const paths = entries(() => apiPaths().map((symbol) => ({ symbol })));

export const access = guard(({ params }: RequestEvent<Params>) => {
  if (!findApiPage(params.symbol)) throw notFound();
});

export const head = ({ params }: { params: Params }) => {
  const page = findApiPage(params.symbol);
  const title = page ? ("entry" in page ? page.entry.entry : page.symbol.name) : "API";
  const description = page ? ("entry" in page ? page.entry.summary : page.symbol.summary || `${page.symbol.name} from ${page.symbol.entry}`) : "";
  return {
    title: `${title} · API · ${site.name}`,
    meta: [{ name: "description", content: description }],
    links: [{ rel: "canonical", href: site.origin + "/api/" + params.symbol + "/" }],
  };
};

/** Doc comment text: paragraphs, ``` fences and `inline code`. */
function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).filter((block) => block.trim());
  return (
    <div class="prose">
      {blocks.map((block) => {
        const fence = /^```\w*\n([\s\S]*?)\n?```$/.exec(block.trim());
        if (fence) return <pre class="api-signature">{fence[1]}</pre>;
        return (
          <p>
            <Inline text={block} />
          </p>
        );
      })}
    </div>
  );
}

function EntryNav({ entry, current }: { entry: ApiEntry; current?: string }) {
  return (
    <nav class="side-column" aria-label={entry.entry + " exports"} data-pagefind-ignore="">
      <p class="side-section-title">
        <a href="/api/" data-rivet-reload="">
          API
        </a>
      </p>
      <div class="side-nav">
        <div class="side-group">
          <p class="side-group-title">
            <a href={entry.href} data-rivet-reload="">
              {entry.entry}
            </a>
          </p>
          <ul>
            {symbolsOf(entry).map((symbol) => (
              <li>
                <a href={symbol.href} data-rivet-reload="" aria-current={symbol.key === current ? "page" : undefined}>
                  <span>{symbol.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

function EntryPage({ entry }: { entry: ApiEntry }) {
  const symbols = symbolsOf(entry);
  return (
    <div class="api-layout">
      <EntryNav entry={entry} />
      <div class="main-column">
        <article class="doc-article" data-pagefind-body="" data-pagefind-filter="section:API">
          <header class="doc-header">
            <p class="doc-eyebrow" data-pagefind-ignore="">
              API reference
            </p>
            <h1>
              <code>{entry.entry}</code>
            </h1>
            <p class="doc-lead">{entry.summary}</p>
            <p>
              <span class="runs-on">{RUNS_ON[entry.runsOn]}</span>
            </p>
          </header>
          <ul class="api-list">
            {symbols.map((symbol) => (
              <li>
                <a href={symbol.href} data-rivet-reload="">
                  <code>{symbol.name}</code>
                </a>
                <span class="api-kind">{symbol.kind}</span>
                {symbol.summary ? (
                  <p>
                    <Inline text={symbol.summary} />
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}

const TYPE_KINDS = new Set(["interface", "type"]);

function SymbolPage({ symbol }: { symbol: ApiSymbol }) {
  const entry = entryOf(symbol);
  const importLine = `import ${TYPE_KINDS.has(symbol.kind) ? "type " : ""}{ ${symbol.name} } from "${symbol.entry}";`;
  return (
    <div class="api-layout">
      <EntryNav entry={entry} current={symbol.key} />
      <div class="main-column">
        <article class="doc-article" data-pagefind-body="" data-pagefind-filter="section:API">
          <header class="doc-header">
            <p class="doc-eyebrow" data-pagefind-ignore="">
              <a href={entry.href} data-rivet-reload="">
                {symbol.entry}
              </a>{" "}
              · {symbol.kind}
            </p>
            <h1>
              <code>{symbol.name}</code>
            </h1>
            {symbol.summary ? (
              <p class="doc-lead">
                <Inline text={symbol.summary} />
              </p>
            ) : null}
            <p class="api-badges">
              <span class="runs-on">{RUNS_ON[symbol.runsOn]}</span>
              {symbol.status === "experimental" ? <span class="status-badge status-experimental">Experimental</span> : null}
              {symbol.since ? <span class="tag">Since {symbol.since}</span> : null}
            </p>
          </header>
          {symbol.deprecated !== undefined ? (
            <aside class="callout callout-warning" aria-label="Deprecated">
              <p class="callout-title">
                <Icon icon={TriangleAlert} size={18} />
                Deprecated
              </p>
              <p>{symbol.deprecated || "Do not use this in new code."}</p>
            </aside>
          ) : null}
          <pre class="api-signature">{importLine}</pre>
          {symbol.signatures.length ? (
            <section>
              <h2 id="signature">Signature</h2>
              <pre class="api-signature">{symbol.signatures.join("\n")}</pre>
            </section>
          ) : null}
          {symbol.remarks && symbol.remarks !== symbol.summary ? (
            <section>
              <h2 id="details">Details</h2>
              <Prose text={symbol.remarks} />
            </section>
          ) : null}
          {symbol.params.length ? (
            <section>
              <h2 id="parameters">Parameters</h2>
              <div class="table-wrap prose">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {symbol.params.map((param) => (
                      <tr>
                        <td>
                          <code>
                            {param.name}
                            {param.optional ? "?" : ""}
                          </code>
                        </td>
                        <td>
                          <code>{param.type}</code>
                        </td>
                        <td>
                          <Inline text={param.doc} />
                          {param.default ? (
                            <span class="api-default">
                              {" "}
                              Default: <code>{param.default}</code>
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {symbol.returns && symbol.returns !== "void" ? (
            <section>
              <h2 id="returns">Returns</h2>
              <pre class="api-signature">{symbol.returns}</pre>
            </section>
          ) : null}
          {symbol.members.length ? (
            <section>
              <h2 id="members">Members</h2>
              <div class="table-wrap prose">
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {symbol.members.map((member) => (
                      <tr>
                        <td>
                          <code class="api-member">{member.signature}</code>
                        </td>
                        <td>
                          <Inline text={member.doc} />
                          {member.default ? (
                            <span class="api-default">
                              {" "}
                              Default: <code>{member.default}</code>
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {symbol.examples.length ? (
            <section>
              <h2 id="examples">Examples</h2>
              {symbol.examples.map((example) => (
                <pre class="api-signature">{example}</pre>
              ))}
            </section>
          ) : null}
          <p class="api-source" data-pagefind-ignore="">
            <a href={symbol.source.url} rel="noopener">
              Source: {symbol.source.file}:{symbol.source.line}
            </a>
          </p>
        </article>
      </div>
    </div>
  );
}

/** `/api/<package path>/` (entry point) and `/api/<package path>/<name>/` (one export). */
export default function ApiPage({ params }: PageProps<"api/[...symbol]">) {
  const page = findApiPage(params.symbol);
  if (!page) throw new Error("Unknown API page " + params.symbol);
  return "entry" in page ? <EntryPage entry={page.entry} /> : <SymbolPage symbol={page.symbol} />;
}
