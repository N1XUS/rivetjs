// Sidebar extensions (Rivet) on a resumed page: tree item `#sx-tree` (MenuTrigger + default MenuIndicator `#sx-ind`,
// sub panel, sub button `#sx-sub`), chip `#sx-chip`, MenuActions `#sx-actions`, Pages (`#sx-to-b` / `#sx-to-a`, value →
// `#sx-page`), opaque mobile backdrop, trigger `#sx-trigger`.
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Folder, House, Pencil, Trash2 } from "lucide";
import { Sidebar, useSidebarPages } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar extensions" };

function PageButton(props: { id: string; to: string; label: string }) {
  const pages = useSidebarPages();
  const to = props.to;
  return (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton id={props.id} onPress={() => pages.setActiveValue(to)}>
        <span>{props.label}</span>
      </Sidebar.MenuButton>
    </Sidebar.MenuItem>
  );
}

export default function SidebarExtensionsStories() {
  const page = signal("a");
  return (
    <Sidebar.Provider id="sx-wrapper">
      <Sidebar id="sx-panel" backdrop="opaque">
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu showGuideLines="hover">
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="sx-home" href="#home" isCurrent>
                  <Icon icon={House} size={16} />
                  <span>Home</span>
                </Sidebar.MenuButton>
                <Sidebar.MenuChip id="sx-chip">5</Sidebar.MenuChip>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem defaultExpanded>
                <Sidebar.MenuTrigger id="sx-tree">
                  <Icon icon={Folder} size={16} />
                  <span>Projects</span>
                  <Sidebar.MenuIndicator id="sx-ind" />
                </Sidebar.MenuTrigger>
                <Sidebar.MenuSub>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton id="sx-sub" href="#atlas">
                      Atlas
                    </Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                </Sidebar.MenuSub>
                <Sidebar.MenuActions id="sx-actions" showOnHover aria-label="Project actions">
                  <Sidebar.MenuAction aria-label="Rename">
                    <Icon icon={Pencil} size={14} />
                  </Sidebar.MenuAction>
                  <Sidebar.MenuAction aria-label="Delete">
                    <Icon icon={Trash2} size={14} />
                  </Sidebar.MenuAction>
                </Sidebar.MenuActions>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
          <Sidebar.Group>
            <Sidebar.Pages value={page}>
              <Sidebar.Page value="a" aria-label="Page A">
                <Sidebar.Menu>
                  <PageButton id="sx-to-b" to="b" label="To B" />
                </Sidebar.Menu>
              </Sidebar.Page>
              <Sidebar.Page value="b" aria-label="Page B">
                <Sidebar.Menu>
                  <PageButton id="sx-to-a" to="a" label="To A" />
                </Sidebar.Menu>
              </Sidebar.Page>
            </Sidebar.Pages>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <Sidebar.Trigger id="sx-trigger" />
        <p id="sx-page">{page()}</p>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
