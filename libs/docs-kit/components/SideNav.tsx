import { ChevronRight } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { areas } from "virtual:docs/nav";
import { StatusBadge } from "./StatusBadge.tsx";
import { sideModel } from "./nav.ts";
import type { NavData, NavItem } from "./types.ts";

function Item({ item, current }: { item: NavItem; current: string }) {
  return (
    <li>
      <a class="side-link" href={item.href} data-rivet-reload="" aria-current={item.href === current ? "page" : undefined}>
        <span class="side-link-text">{item.title}</span>
        {item.tag ? <span class={"nav-tag nav-tag-" + item.tag}>{item.tag === "new" ? "New" : "Updated"}</span> : null}
        {/* Only "Planned" here: most pages are experimental, the page header shows the status. */}
        {item.status === "planned" ? <StatusBadge status={item.status} small /> : null}
      </a>
    </li>
  );
}

/**
 * Side navigation of an area (top-bar section): its sections as headings, each group a native
 * `<details>` (collapsible without JS). The group holding the current page renders open; small areas
 * render every group open. Static markup: no JS on the page for the nav.
 */
export function SideNav({ sections, area, path, label }: { sections: NavData; area: string; path: string; label?: string }) {
  const parts = sideModel(sections, areas, area, path);
  if (!parts) return null;
  const current = path.endsWith("/") ? path : path + "/";
  const title = areas.find((a) => a.id === area)?.title ?? "";
  return (
    <nav class="side-nav" aria-label={label ?? title + " pages"} data-pagefind-ignore="">
      {parts.map((part) => (
        <div class="side-part">
          {part.title ? <p class="side-title">{part.title}</p> : null}
          {part.groups.map((group) => (
            <details class="side-group" open={group.open ? true : undefined} data-current={group.current ? "" : undefined}>
              <summary class="side-summary">
                <span class="side-summary-text">{group.title}</span>
                <Icon icon={ChevronRight} size={16} class="side-chevron" />
              </summary>
              <ul class="side-list">
                {group.items.map((item) => (
                  <Item item={item} current={current} />
                ))}
              </ul>
            </details>
          ))}
        </div>
      ))}
    </nav>
  );
}
