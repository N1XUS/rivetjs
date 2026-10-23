import { notFound, type PageProps, type RequestEvent, entries, guard, load } from "@rivetjs/router";
import { examples } from "virtual:docs/examples";
import { Example } from "@rivetjs/docs-kit/components/Example.tsx";
import { site } from "virtual:docs/site";

type Params = { id: string };

/** Prerender one page per example. */
export const paths = entries(() => Object.keys(examples).map((id) => ({ id })));

export const access = guard(({ params }: RequestEvent<Params>) => {
  if (!examples[params.id]) throw notFound();
});

export const loader = load(({ params }: RequestEvent<Params>) => {
  const example = examples[params.id];
  if (!example) throw notFound();
  return example;
});

export const head = ({ params }: { params: Params }) => {
  const example = examples[params.id];
  return {
    title: `${example?.title ?? "Example"} · Examples · ${site.name}`,
    meta: [{ name: "description", content: example?.summary ?? "" }],
    links: [{ rel: "canonical", href: site.origin + "/examples/" + params.id + "/" }],
  };
};

/** One example on its own page, with links to the pages that explain it. */
export default function ExamplePage({ data: example }: PageProps<typeof loader>) {
  return (
    <div class="wide-page">
      <header class="doc-header">
        <p class="doc-eyebrow">
          <a href="/examples/" data-rivet-reload="">
            Examples
          </a>
        </p>
        <h1>{example.title}</h1>
        <p class="doc-lead">{example.summary}</p>
      </header>
      <div data-pagefind-body="" data-pagefind-filter="section:Examples">
        <Example id={example.id} example={example} eager />
        {example.usedOn.length ? (
          <section class="prose">
            <h2 id="explained-in">Explained in</h2>
            <ul>
              {example.usedOn.map((page) => (
                <li>
                  <a href={page.href} data-rivet-reload="">
                    {page.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
