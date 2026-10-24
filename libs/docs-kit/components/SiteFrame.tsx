import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { areas, sections } from "virtual:docs/nav";
import { site } from "virtual:docs/site";
import { MobileMenu } from "./MobileMenu.tsx";
import { SearchButton } from "./SearchButton.tsx";
import { SideNav } from "./SideNav.tsx";
import { ThemeMenu } from "./ThemeMenu.tsx";
import { areaOf, ROUTE_ITEMS, topItems } from "./nav.ts";
import { watchCodeAtIdle } from "./code-watch.tsx";
import { frameIdOf } from "../frame-theme.ts";

export interface FooterLink {
  title: string;
  href: string;
}
export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const external = (href: string) => /^https?:/.test(href);

/** `0.0.0-experimental` → `v0.0.0` (the full version is the title). */
const shortVersion = (version: string) => "v" + version.split("-")[0];

/** Default footer: the areas, the site routes, the project links. */
function defaultColumns(extra: FooterColumn[]): FooterColumn[] {
  return [
    { title: "Docs", links: areas.map((area) => ({ title: area.title, href: area.href })) },
    { title: "Reference", links: [...ROUTE_ITEMS.map((item) => ({ title: item.title, href: item.href })), { title: "Search", href: "/search/" }] },
    ...extra,
    {
      title: "Project",
      links: [
        { title: "Source on GitHub", href: site.repo },
        { title: "Issues", href: site.repo + "/issues" },
      ],
    },
  ];
}

function SiteFooter({ columns }: { columns: FooterColumn[] }) {
  return (
    <footer class="site-footer" data-pagefind-ignore="">
      <div class="footer-columns">
        {columns.map((column) => (
          <div class="footer-column">
            <p class="footer-title">{column.title}</p>
            <ul>
              {column.links.map((link) => (
                <li>
                  {external(link.href) ? (
                    <a href={link.href} rel="noopener">
                      {link.title}
                    </a>
                  ) : (
                    <a href={link.href} data-rivet-reload="">
                      {link.title}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p class="footer-note">
        {site.name} {site.version} is experimental software. Fonts: Manrope and Fira Code (SIL Open Font License 1.1).
      </p>
    </footer>
  );
}

/** Top-bar section links (desktop bar; the drawer lists the same items). */
export function TopLinks({ path, class: cls }: { path: string; class: string }) {
  const active = areaOf(sections, path);
  return (
    <ul class={cls}>
      {topItems(areas).map((item) => (
        <li>
          <a class="top-link" href={item.href} data-rivet-reload="" aria-current={item.id === active ? "true" : undefined}>
            {item.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Site frame: skip link, top bar (menu drawer below 900px, logo + version, area / API / Examples links,
 * search, theme menu, GitHub), the side nav of the current area (when the URL belongs to one), the
 * page, the footer inside the content column. `path` = the request path (`url().pathname` in the app
 * layout). `links` adds footer columns between the reference and project columns. At idle the browser
 * starts the code highlighter (`highlight-browser.ts`). Example frame pages (`/examples/<id>/frame/…`) render bare.
 */
export function SiteFrame({ path, links = [], children }: { path: string; links?: FooterColumn[]; children?: JSX.Element | readonly JSX.Element[] }) {
  if (frameIdOf(path)) return children;
  const area = areaOf(sections, path);
  const side = area && area !== "api" && area !== "examples" ? area : undefined;
  const columns = defaultColumns(links);
  // Lean pages skip generic idle highlighting/search setup; page-owned visible effects can still run.
  const lean = site.leanPages?.includes(path) ?? false;
  // Code blocks are plain server text; the browser colours visible ones (shared lazy highlighter chunk).
  if (!lean) watchCodeAtIdle();
  return (
    <div class={side ? "frame frame-side" : "frame"}>
      <a class="skip-link" href="#content">
        Skip to main content
      </a>
      <header class="top-bar" data-pagefind-ignore="">
        <MobileMenu />
        <a class="top-brand" href="/" data-rivet-reload="">
          <span class="top-brand-mark" aria-hidden="true" />
          <span>{site.name}</span>
        </a>
        <span class="top-version" title={"Docs version " + site.version}>
          {shortVersion(site.version)}
        </span>
        <nav class="top-sections" aria-label="Sections">
          <TopLinks path={path} class="top-list" />
        </nav>
        <div class="top-tools">
          <SearchButton variant="bar" shortcuts={!lean} />
          <SearchButton variant="icon" />
          <ThemeMenu />
          <a class="top-github" href={site.repo} rel="noopener">
            GitHub
          </a>
        </div>
      </header>
      <div class="frame-body">
        {side ? <SideNav sections={sections} area={side} path={path} /> : null}
        <main id="content" class="frame-main" tabIndex={-1}>
          {children}
          <SiteFooter columns={columns} />
        </main>
      </div>
    </div>
  );
}
