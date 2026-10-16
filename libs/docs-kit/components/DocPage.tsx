import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { clientEvent } from "@rivetjs/runtime/dom";
import { ArrowLeft, ArrowRight, ArrowUp, ChevronRight, Info, Pencil } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { areas, sections } from "virtual:docs/nav";
import { site } from "virtual:docs/site";
import { StatusBadge } from "./StatusBadge.tsx";
import { breadcrumbOf, sectionOf } from "./nav.ts";
import { spy, spyState } from "./browser.ts";
import type { PageInfo } from "./types.ts";

/** "On this page" links (h2, h3). */
function TocList({ toc }: { toc: PageInfo["toc"] }) {
  return (
    <ul class="toc-list">
      {toc.map((entry) => (
        <li class={entry.depth === 3 ? "toc-sub" : undefined}>
          <a href={"#" + entry.id}>{entry.text}</a>
        </li>
      ))}
    </ul>
  );
}

/** TOC column + scroll-spy. The spy's code loads on the first scroll (`preload: "intent"`): nothing before. */
function Toc({ toc }: { toc: PageInfo["toc"] }) {
  clientEvent(
    window,
    "scroll",
    () => {
      if (spyState.queued) return;
      spyState.queued = true;
      requestAnimationFrame(spy);
    },
    { passive: true, preload: "intent" },
  );
  return (
    <aside class="toc-column" aria-labelledby="toc-title" data-pagefind-ignore="">
      <div class="toc-sticky">
        <p class="toc-title" id="toc-title">
          On this page
        </p>
        <TocList toc={toc} />
        <a class="toc-top" href="#content">
          <Icon icon={ArrowUp} size={16} />
          Back to the top
        </a>
      </div>
    </aside>
  );
}

/**
 * Content page: header panel (breadcrumb, title, lead, status, edit link), inline TOC (narrow
 * screens), prose, related pages, prev/next, TOC column. The site frame (`SiteFrame`) around it holds
 * the top bar, side nav and footer. Static per page (no signals): navigation between pages is a full load.
 */
export function DocPage({ page, children }: { page: PageInfo; children?: JSX.Element | readonly JSX.Element[] }) {
  const crumbs = breadcrumbOf(sections, areas, page.path);
  const edit = `${site.repo}/edit/${site.repoRef}/${page.source}`;
  const section = sectionOf(sections, page.path)?.title ?? "";
  return (
    <div class={page.toc.length ? "docs-grid" : "docs-grid docs-grid-no-toc"}>
      <article class="doc-article" data-pagefind-body="" data-pagefind-filter={"section:" + section} data-pagefind-meta={"status:" + page.status}>
        <header class="doc-header">
          <div class="doc-header-top" data-pagefind-ignore="">
            {crumbs.length ? (
              <nav class="breadcrumb" aria-label="Breadcrumb">
                <ol>
                  {crumbs.map((crumb) => (
                    <li>
                      <a href={crumb.href} data-rivet-reload="">
                        {crumb.title}
                      </a>
                      <Icon icon={ChevronRight} size={14} class="breadcrumb-sep" />
                    </li>
                  ))}
                </ol>
              </nav>
            ) : (
              <span />
            )}
            <a class="doc-edit" href={edit} rel="noopener" title="Edit this page on GitHub" aria-label="Edit this page on GitHub">
              <Icon icon={Pencil} size={18} />
            </a>
          </div>
          <h1>{page.title}</h1>
          <p class="doc-lead">{page.description}</p>
          {page.status === "stable" ? null : (
            <p class="doc-status" data-pagefind-ignore="">
              <StatusBadge status={page.status} />
              {page.status === "experimental" ? " This feature works today, but its API may still change." : " This feature is not available yet."}
            </p>
          )}
        </header>
        {page.toc.length > 2 ? (
          <details class="toc-inline" data-pagefind-ignore="">
            <summary>
              <Icon icon={ChevronRight} size={16} class="toc-inline-icon" />
              On this page
            </summary>
            <TocList toc={page.toc} />
          </details>
        ) : null}
        {page.status === "planned" && page.spec ? (
          <aside class="callout callout-note" aria-label="Status">
            <p class="callout-title">
              <Icon icon={Info} size={18} />
              Planned
            </p>
            <p>
              This page describes work in progress. Read the <a href={page.spec} rel="noopener">design document</a> for the current plan.
            </p>
          </aside>
        ) : null}
        <div class="prose">{children}</div>
        {page.related.length ? (
          <section class="related" aria-labelledby="related-title" data-pagefind-ignore="">
            <h2 id="related-title">Related</h2>
            <ul class="related-list">
              {page.related.map((link) => (
                <li>
                  <a href={link.href} data-rivet-reload="">
                    {link.title}
                    <Icon icon={ChevronRight} size={16} />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <footer class="doc-footer" data-pagefind-ignore="">
          <nav class="prev-next" aria-label="Previous and next page">
            {page.prev ? (
              <a class="prev" href={page.prev.href} data-rivet-reload="" data-rivet-prefetch="prerender" rel="prev">
                <span class="prev-next-label">
                  <Icon icon={ArrowLeft} size={14} />
                  Previous
                </span>
                {page.prev.title}
              </a>
            ) : (
              <span />
            )}
            {page.next ? (
              <a class="next" href={page.next.href} data-rivet-reload="" data-rivet-prefetch="prerender" rel="next">
                <span class="prev-next-label">
                  Next
                  <Icon icon={ArrowRight} size={14} />
                </span>
                {page.next.title}
              </a>
            ) : null}
          </nav>
          <p class="edit-link">
            <a href={edit} rel="noopener">
              Edit this page
            </a>
            {" · "}
            <a href={site.repo + "/issues/new?title=" + encodeURIComponent("Docs: " + page.title)} rel="noopener">
              Report a problem
            </a>
          </p>
        </footer>
      </article>
      {page.toc.length ? <Toc toc={page.toc} /> : null}
    </div>
  );
}
