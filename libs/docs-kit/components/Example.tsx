import { TriangleAlert } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { CopyButton } from "./CodeBlock.tsx";
import { framePath } from "../frame-theme.ts";
import type { ExampleFile, ExampleView } from "./types.ts";

const linesOf = (file: ExampleFile) => file.text.replace(/\n$/, "").split("\n");
const langOfPath = (path: string) => path.match(/\.([a-z]+)$/)?.[1] ?? "txt";

/**
 * Plain lines of a file (optionally a 1-based inclusive range), one `span.line` each (notation marks as `mark-*`);
 * coloured after prerender (`tools/highlight-pages.ts`; dev: by `highlighter.ts` in the browser).
 */
function Lines({ file, range }: { file: ExampleFile; range?: [number, number] }) {
  const all = linesOf(file);
  const from = range ? range[0] : 1;
  const lines = range ? all.slice(range[0] - 1, range[1]) : all;
  return (
    <pre tabIndex={0} data-lang={langOfPath(file.path)}>
      <code>
        {lines.map((line, index) => {
          const mark = file.marks?.[from + index];
          return [index ? "\n" : "", <span class={mark ? "line mark-" + mark : "line"}>{line}</span>];
        })}
      </code>
    </pre>
  );
}

/** One code tab: the `#region demo` part first, the whole file behind a disclosure. */
function CodePanel({ file }: { file: ExampleFile }) {
  if (!file.focus) {
    return (
      <div class="code-panel">
        <Lines file={file} />
        <CopyButton />
      </div>
    );
  }
  return (
    <div>
      <div class="code-panel">
        <Lines file={file} range={file.focus} />
        <CopyButton />
      </div>
      <details class="full-file">
        <summary>Show the whole file ({linesOf(file).length} lines)</summary>
        <div class="code-panel">
          <Lines file={file} />
          <CopyButton />
        </div>
      </details>
    </div>
  );
}

/**
 * What loaded: numbers measured in Chromium against the built frame page (cold cache, brotli), written into this
 * paragraph after the docs build's checks (`tools/example-checks.ts`); empty (hidden) on the dev server.
 */
function WhatLoaded({ id }: { id: string }) {
  return <p class="what-loaded" data-measure={id}></p>;
}

/**
 * A live example: preview (the example's frame page, `/examples/<id>/frame/`, a page of this docs app without its
 * chrome), code tabs, the frame page's HTML (fetched and formatted in the browser when the tab is shown), and a
 * toolbar (reload, phone width, new tab). An auto-height example's iframe (`data-auto-height`) takes the height its
 * page posts (`frame-theme.ts`). Tabs are radio buttons styled with CSS, so the frame works without
 * JavaScript. Examples that need a server are shown as code only.
 */
export function Example({ id, example, eager }: { id: string; example: ExampleView | undefined; eager?: boolean }) {
  if (!example) {
    return (
      <aside class="callout callout-warning" aria-label="Example missing">
        <p class="callout-title">
          <Icon icon={TriangleAlert} size={18} />
          Example missing
        </p>
        <p>
          There is no example "{id}" (examples/{id}/example.ts).
        </p>
      </aside>
    );
  }
  const live = !example.codeOnly;
  const src = framePath(id);
  const frame = "example-" + id;
  const tabs = [...(live ? ["Preview"] : []), ...example.files.map((file) => file.path.split("/").pop()!), ...(live ? ["Server HTML"] : [])];
  // Panel order matches the tabs: preview, one per file, server HTML.
  const first = live ? 1 : 0;
  return (
    <figure class="example" data-pagefind-ignore="">
      <div class="example-head">
        <figcaption class="example-title">{example.title}</figcaption>
        <fieldset class="example-tabs" aria-label={example.title + " views"}>
          {tabs.map((label, index) => (
            <>
              <input type="radio" name={frame + "-tab"} id={frame + "-tab-" + index} value={String(index)} checked={index === 0} />
              <label for={frame + "-tab-" + index}>{label}</label>
            </>
          ))}
        </fieldset>
      </div>
      {live ? (
        <div class="example-panel example-preview" data-panel="0">
          <iframe
            src={src}
            name={frame}
            title={example.title + " (live example)"}
            height={String(example.height)}
            data-auto-height={example.auto ? "" : undefined}
            loading={eager ? "eager" : "lazy"}
            allow="clipboard-write"
          />
        </div>
      ) : null}
      {example.files.map((file, index) => (
        <div class="example-panel" data-panel={String(first + index)}>
          <p class="sr-only">{file.path}</p>
          <CodePanel file={file} />
        </div>
      ))}
      {live ? (
        <div class="example-panel" data-panel={String(first + example.files.length)}>
          <div class="code-panel">
            <pre tabIndex={0} data-lang="html" data-src={src}>
              <code>
                <span class="line">
                  {"<!-- The HTML the server sends for the preview (loads with JavaScript; or open the preview in a new tab and view its source) -->"}
                </span>
              </code>
            </pre>
            <CopyButton />
          </div>
        </div>
      ) : null}
      {live ? null : <p class="server-note">This example is shown as code: {example.codeOnly}. Run it locally from the server starter.</p>}
      <div class="example-toolbar">
        {live ? (
          <>
            <a href={src} target={frame} title="Reload the preview">
              Reload
            </a>
            <label>
              <input type="checkbox" class="phone-toggle" checked={example.phone} /> Phone width
            </label>
            <a href={src} target="_blank" rel="noopener">
              Open in new tab
            </a>
          </>
        ) : null}
        <a href={"/examples/" + id + "/"} data-rivet-reload="">
          About this example
        </a>
      </div>
      {live ? <WhatLoaded id={id} /> : null}
    </figure>
  );
}
