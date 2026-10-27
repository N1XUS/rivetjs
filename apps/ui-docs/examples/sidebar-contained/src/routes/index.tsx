// Rivet-authored Sidebar demo (Rivet addition: `contained` provider mode, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Card } from "@rivetjs/ui/card";
import { Sidebar } from "@rivetjs/ui/sidebar";
import { Archive, Inbox, Send, Star } from "lucide";

export const head = { title: "Sidebar: Contained in a panel" };

// #region demo
const FOLDERS = [
  { id: "inbox", label: "Inbox", icon: Inbox, count: 4 },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "archive", label: "Archive", icon: Archive },
];

export function Contained() {
  return (
    <Card id="sbc-panel" class="h-80 w-full max-w-3xl overflow-hidden p-0">
      <Sidebar.Provider contained class="h-full">
        <Sidebar collapsible="icon">
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Mail</Sidebar.GroupLabel>
              <Sidebar.Menu>
                {FOLDERS.map((folder, i) => (
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton id={`sbc-${folder.id}`} href={`#${folder.id}`} isActive={i === 0} tooltip={folder.label}>
                      <Icon icon={folder.icon} size={16} />
                      <span>{folder.label}</span>
                    </Sidebar.MenuButton>
                    {folder.count ? <Sidebar.MenuBadge>{folder.count}</Sidebar.MenuBadge> : null}
                  </Sidebar.MenuItem>
                ))}
              </Sidebar.Menu>
            </Sidebar.Group>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Inset>
          <header class="flex h-12 items-center gap-2 border-b border-separator px-3">
            <Sidebar.Trigger id="sbc-trigger" />
            <span class="text-sm font-medium">Inbox</span>
          </header>
          <p class="p-4 text-sm text-muted">The sidebar fills the card's height and collapses inside it.</p>
        </Sidebar.Inset>
      </Sidebar.Provider>
    </Card>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Contained />
    </div>
  );
}
