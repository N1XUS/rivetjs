import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: loading skeleton" };

// #region demo
export default function SidebarSkeleton() {
  return (
    <Sidebar.Provider>
      <Sidebar collapsible="none" class="h-svh">
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Loading</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {[1, 2, 3, 4, 5].map(() => (
                <Sidebar.MenuItem>
                  <Sidebar.MenuSkeleton showIcon />
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
    </Sidebar.Provider>
  );
}
// #endregion
