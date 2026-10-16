import { examples } from "virtual:docs/examples";
import { StatusBadge } from "@rivetjs/docs-kit/components/StatusBadge.tsx";
import { site } from "virtual:docs/site";

export const head = {
  title: "Examples · " + site.name,
  meta: [{ name: "description", content: `Small ${site.name} apps you can run here and read.` }],
  links: [{ rel: "canonical", href: site.origin + "/examples/" }],
};

/** Gallery of every example, grouped by its first tag. */
export default function Examples() {
  const all = Object.values(examples).sort((a, b) => a.title.localeCompare(b.title));
  return (
    <div class="wide-page">
      <header class="doc-header">
        <p class="doc-eyebrow">Examples</p>
        <h1>Examples</h1>
        <p class="doc-lead">Each example is a small, complete app. It runs here as a page of this site's production build, next to its code.</p>
      </header>
      <ul class="card-grid example-gallery" data-pagefind-body="" data-pagefind-filter="section:Examples">
        {all.map((example) => (
          <li>
            <a class="card" href={"/examples/" + example.id + "/"} data-rivet-reload="">
              <span class="font-semibold">{example.title}</span>
              {example.status === "stable" ? null : <StatusBadge status={example.status} small />}
              <p>{example.summary}</p>
              <p class="example-card-tags">
                {example.codeOnly ? <span class="tag">code only</span> : <span class="tag">live</span>}
                {example.tags.map((tag) => (
                  <span class="tag">{tag}</span>
                ))}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
