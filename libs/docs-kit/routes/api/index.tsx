import { api, packageOf, RUNS_ON } from "@rivetjs/docs-kit/api.ts";
import { packages as PACKAGES } from "virtual:docs/api-config";
import { site } from "virtual:docs/site";

export const head = {
  title: "API reference · " + site.name,
  meta: [{ name: "description", content: `Every public export of the ${site.name} packages, grouped by import path.` }],
  links: [{ rel: "canonical", href: site.origin + "/api/" }],
};

/** API index: packages → entry points (import paths) → symbols. Generated from the TypeScript sources. */
export default function ApiIndex() {
  return (
    <div class="wide-page">
      <header class="doc-header">
        <p class="doc-eyebrow">Reference</p>
        <h1>API reference</h1>
        <p class="doc-lead">
          Every public export, grouped by the path you import it from. It is generated from the source code and its comments, so it always matches the code in
          this version.
        </p>
      </header>
      <div data-pagefind-body="" data-pagefind-filter="section:API">
        {PACKAGES.map((pkg) => {
          const entries = api.entries.filter((e) => packageOf(e.entry) === pkg.name);
          return (
            <section class="api-package" aria-labelledby={"pkg-" + pkg.title.toLowerCase().replace(/\s+/g, "-")}>
              <h2 id={"pkg-" + pkg.title.toLowerCase().replace(/\s+/g, "-")}>
                {pkg.title} <code class="api-package-name">{pkg.name}</code>
              </h2>
              <p class="api-package-summary">{pkg.summary}</p>
              <div class="card-grid">
                {entries.map((entry) => (
                  <a class="card" href={entry.href} data-rivet-reload="">
                    <code class="font-semibold">{entry.entry}</code>
                    <p>{entry.summary}</p>
                    <p class="api-card-meta">
                      <span class="runs-on">{RUNS_ON[entry.runsOn]}</span> {entry.symbols.length} exports
                    </p>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
