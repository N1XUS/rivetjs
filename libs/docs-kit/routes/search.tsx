import { sections } from "virtual:docs/nav";
import { site } from "virtual:docs/site";

export const head = {
  title: "Search · " + site.name,
  meta: [{ name: "description", content: `Search the ${site.name} docs, or browse every page.` }],
  links: [{ rel: "canonical", href: site.origin + "/search/" }],
};

/**
 * Search page: the target of the search button without JavaScript, and of `/search/?q=…` links (this form submits one).
 * With JavaScript a `?q=` opens the search dialog with the query: the docs page script does it (`components/page-script.ts`,
 * imported at load by `document.ts`'s stub only on this page with a `q` parameter), so the page is static and ships no
 * JS before input (STATIC-ZERO-3; it was a load-time `clientEffect` that booted the resume runtime). It always lists
 * every page.
 */
export default function Search() {
  return (
    <div class="wide-page">
      <header class="doc-header">
        <h1>Search</h1>
        <p class="doc-lead">Type a word or a name. Search runs in your browser; it needs JavaScript. Every page is also listed below.</p>
      </header>
      <form class="search-page-form" method="get" action="/search/" role="search">
        <label for="search-page-input" class="sr-only">
          Search the docs
        </label>
        <input id="search-page-input" type="search" name="q" placeholder="Search the docs" />
        <button type="submit">Search</button>
      </form>
      <div class="page-index">
        {sections.map((section) => (
          <section aria-labelledby={"index-" + section.id}>
            <h2 id={"index-" + section.id}>{section.title}</h2>
            {section.groups.map((group) => (
              <div>
                {group.title !== section.title ? <h3>{group.title}</h3> : null}
                <ul>
                  {group.items.map((item) => (
                    <li>
                      <a href={item.href} data-rivet-reload="">
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
