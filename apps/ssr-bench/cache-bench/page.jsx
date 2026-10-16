// Docs-style page for the render-cache benchmark (`run.ts`): a mostly static layout (site header with nav +
// search, a 12 × 12 sidebar tree with the current page highlighted, footer) around a per-request article
// (loader data: unique values every request). `MODE` is replaced per build by run.ts:
// - "off": plain components (Rivet without cache, the baseline);
// - "components": SiteHeader / Sidebar / Footer go through `cached()` — what the compiler's `_cached` call
//   sites do for proven prop-pure components;
// - "shell": the whole layout is a `shell()` keyed by the current path; the article is its `children` hole.
import { cached, shell } from "@rivetjs/runtime/server-cache";

const MODE = "off";
const pure = MODE === "components" ? (component, id) => cached(component, { id, inert: true }) : (component) => component;
const layout = MODE === "shell" ? (component, id) => shell(component, { id, inert: true }) : (component) => component;

const TOP = ["Guide", "Reference", "Components", "Router", "Forms", "i18n", "Blog", "Changelog"];
const SECTIONS = Array.from({ length: 12 }, (_, s) => ({
  title: "Section " + (s + 1) + " & more",
  links: Array.from({ length: 12 }, (_, l) => ({ href: "/docs/s" + s + "/page-" + l, label: "Topic " + s + "." + l + " <overview>" })),
}));
const FOOTER = [
  { title: "Docs", links: ["Getting started", "Tutorial", "Examples", "API", "FAQ", "Migration"] },
  { title: "Community", links: ["GitHub", "Discord", "Forum", "Events", "Blog", "Newsletter"] },
  { title: "Company", links: ["About", "Careers", "Brand", "Contact", "Press", "Partners"] },
  { title: "Legal", links: ["Privacy", "Terms", "Cookies", "Licenses", "Security", "Status"] },
];

function SiteHeaderImpl(props) {
  return (
    <header class="site-header">
      <a class="logo" href="/" aria-label="Home">
        <span class="mark">R</span>
        <span class="name">{props.product}</span>
      </a>
      <nav class="top-nav" aria-label="Main">
        <ul>
          {TOP.map((item) => (
            <li>
              <a href={"/" + item.toLowerCase()} class={item === props.section ? "active" : ""}>
                {item}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <form class="search" action="/search" method="get" role="search">
        <label for="q">Search the docs</label>
        <input id="q" name="q" type="search" placeholder="Search…" autocomplete="off" />
        <button type="submit">Go</button>
      </form>
      <a class="cta" href="/docs/getting-started">
        Get started
      </a>
    </header>
  );
}
const SiteHeader = pure(SiteHeaderImpl, "page#SiteHeader");

function SidebarImpl(props) {
  return (
    <aside class="sidebar">
      <nav aria-label="Docs">
        {SECTIONS.map((section) => (
          <section class="group">
            <h3>{section.title}</h3>
            <ul>
              {section.links.map((link) => (
                <li class={link.href === props.current ? "item current" : "item"}>
                  <a href={link.href} aria-current={link.href === props.current ? "page" : undefined}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  );
}
const Sidebar = pure(SidebarImpl, "page#Sidebar");

function FooterImpl(props) {
  return (
    <footer class="site-footer">
      <div class="columns">
        {FOOTER.map((column) => (
          <div class="column">
            <h4>{column.title}</h4>
            <ul>
              {column.links.map((label) => (
                <li>
                  <a href={"/" + column.title.toLowerCase() + "/" + label.toLowerCase().replaceAll(" ", "-")}>{label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p class="legal">
        © {props.year} {props.product} contributors. Released under the MIT license.
      </p>
    </footer>
  );
}
const Footer = pure(FooterImpl, "page#Footer");

function DocsLayoutImpl(props) {
  return (
    <div class="docs">
      <SiteHeader product="Rivet" section="Guide" />
      <div class="body">
        <Sidebar current={props.current} />
        <main class="content">{props.children}</main>
      </div>
      <Footer product="Rivet" year={2026} />
    </div>
  );
}
const DocsLayout = layout(DocsLayoutImpl, "page#DocsLayout");

function Article(props) {
  const doc = props.doc;
  return (
    <article data-token={doc.token}>
      <nav class="crumbs" aria-label="Breadcrumb">
        {doc.crumbs.map((crumb) => (
          <a href={crumb.href}>{crumb.label}</a>
        ))}
      </nav>
      <h1>{doc.title}</h1>
      <p class="meta">
        Updated {doc.updated} · {doc.minutes} min read
      </p>
      <nav class="toc" aria-label="On this page">
        <ol>
          {doc.sections.map((section) => (
            <li>
              <a href={"#" + section.id}>{section.heading}</a>
            </li>
          ))}
        </ol>
      </nav>
      {doc.sections.map((section) => (
        <section id={section.id}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((text) => (
            <p>{text}</p>
          ))}
        </section>
      ))}
      <table class="api">
        <thead>
          <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {doc.options.map((option) => (
            <tr>
              <td>
                <code>{option.name}</code>
              </td>
              <td>{option.type}</td>
              <td>{option.value}</td>
              <td>{option.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

/** The page for one request: layout around the request's article. */
export function Page(props) {
  return (
    <DocsLayout current={props.doc.path}>
      <Article doc={props.doc} />
    </DocsLayout>
  );
}
