// Sidebar badges next to menu actions (user bug 2026-10-09: a count badge and a `showOnHover` "more" action drawn on top
// of each other). Static panels (`collapsible="none"`) in `#bd-ltr` / `#bd-rtl` (`dir="rtl"`): items `#bd-hover`
// (badge + showOnHover action), `#bd-always` (badge + action), `#bd-chip` (chip + showOnHover MenuActions),
// `#bd-chip-always` (chip + MenuActions), `#bd-sm` / `#bd-lg` (sizes, badge + showOnHover action); a collapsed
// `collapsible="icon"` panel `#bd-icon` with the same badge + action item `#bd-icon-item` and a group action.
import { Icon } from "@rivetjs/kit/icon";
import { Archive, CheckCheck, Ellipsis, Folder, Inbox, Plus } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar badges" };

function Items(props: { prefix: string }) {
  const p = props.prefix;
  return (
    <Sidebar.Content>
      <Sidebar.Group>
        <Sidebar.GroupLabel>Projects</Sidebar.GroupLabel>
        <Sidebar.GroupAction aria-label="Add project">
          <Icon icon={Plus} size={16} />
        </Sidebar.GroupAction>
        <Sidebar.Menu>
          <Sidebar.MenuItem id={`${p}-hover`}>
            <Sidebar.MenuButton href="#projects">
              <Icon icon={Folder} size={16} />
              <span>Projects with a long name</span>
            </Sidebar.MenuButton>
            <Sidebar.MenuBadge>12</Sidebar.MenuBadge>
            <Sidebar.MenuAction showOnHover aria-label="More">
              <Icon icon={Ellipsis} size={16} />
            </Sidebar.MenuAction>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem id={`${p}-always`}>
            <Sidebar.MenuButton href="#archive">
              <Icon icon={Archive} size={16} />
              <span>Archive with a long name</span>
            </Sidebar.MenuButton>
            <Sidebar.MenuBadge>128</Sidebar.MenuBadge>
            <Sidebar.MenuAction aria-label="More">
              <Icon icon={Ellipsis} size={16} />
            </Sidebar.MenuAction>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem id={`${p}-chip`}>
            <Sidebar.MenuButton href="#inbox">
              <Icon icon={Inbox} size={16} />
              <span>Inbox with a long name</span>
            </Sidebar.MenuButton>
            <Sidebar.MenuChip color="danger">3</Sidebar.MenuChip>
            <Sidebar.MenuActions showOnHover aria-label="Inbox actions">
              <Sidebar.MenuAction aria-label="Mark all read">
                <Icon icon={CheckCheck} size={14} />
              </Sidebar.MenuAction>
              <Sidebar.MenuAction aria-label="Archive">
                <Icon icon={Archive} size={14} />
              </Sidebar.MenuAction>
            </Sidebar.MenuActions>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem id={`${p}-chip-always`}>
            <Sidebar.MenuButton href="#drafts">
              <Icon icon={Inbox} size={16} />
              <span>Drafts with a long name</span>
            </Sidebar.MenuButton>
            <Sidebar.MenuChip>7</Sidebar.MenuChip>
            <Sidebar.MenuActions aria-label="Draft actions">
              <Sidebar.MenuAction aria-label="Mark all read">
                <Icon icon={CheckCheck} size={14} />
              </Sidebar.MenuAction>
              <Sidebar.MenuAction aria-label="Archive">
                <Icon icon={Archive} size={14} />
              </Sidebar.MenuAction>
            </Sidebar.MenuActions>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem id={`${p}-sm`}>
            <Sidebar.MenuButton size="sm" href="#small">
              <Icon icon={Folder} size={16} />
              <span>Small with a long name</span>
            </Sidebar.MenuButton>
            <Sidebar.MenuBadge>4</Sidebar.MenuBadge>
            <Sidebar.MenuAction showOnHover aria-label="More">
              <Icon icon={Ellipsis} size={16} />
            </Sidebar.MenuAction>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem id={`${p}-lg`}>
            <Sidebar.MenuButton size="lg" href="#large">
              <Icon icon={Folder} size={16} />
              <span>Large with a long name</span>
            </Sidebar.MenuButton>
            <Sidebar.MenuBadge>99+</Sidebar.MenuBadge>
            <Sidebar.MenuAction showOnHover aria-label="More">
              <Icon icon={Ellipsis} size={16} />
            </Sidebar.MenuAction>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Group>
    </Sidebar.Content>
  );
}

export default function SidebarBadgesStories() {
  return (
    <Sidebar.Provider id="bd-wrapper" defaultOpen={false} toggleShortcut={false}>
      <Sidebar id="bd-icon" collapsible="icon">
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Projects</Sidebar.GroupLabel>
            <Sidebar.GroupAction aria-label="Add project">
              <Icon icon={Plus} size={16} />
            </Sidebar.GroupAction>
            <Sidebar.Menu>
              <Sidebar.MenuItem id="bd-icon-item">
                <Sidebar.MenuButton href="#projects" tooltip="Projects">
                  <Icon icon={Folder} size={16} />
                  <span>Projects</span>
                </Sidebar.MenuButton>
                <Sidebar.MenuBadge>12</Sidebar.MenuBadge>
                <Sidebar.MenuAction showOnHover aria-label="More">
                  <Icon icon={Ellipsis} size={16} />
                </Sidebar.MenuAction>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <div class="flex gap-4 p-4">
          <div id="bd-ltr" class="h-[26rem] w-64">
            <Sidebar.Provider>
              <Sidebar collapsible="none" class="h-full">
                <Items prefix="bd" />
              </Sidebar>
            </Sidebar.Provider>
          </div>
          <div id="bd-rtl" dir="rtl" class="h-[26rem] w-64">
            <Sidebar.Provider>
              <Sidebar collapsible="none" class="h-full">
                <Items prefix="bd-rtl" />
              </Sidebar>
            </Sidebar.Provider>
          </div>
        </div>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
