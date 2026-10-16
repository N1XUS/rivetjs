// Type-level suite (`tsc -p libs/ui` only): `Sidebar` parts accept the cdk props (+ `class`), `Sidebar["…Props"]`,
// menu-button sizes / variants / tooltip string; errors: unknown variant / size / collapsible.
import { signal } from "@rivetjs/reactivity";
import { Sidebar } from "../src/components/sidebar/index.ts";

const open = signal(true);

export const ok = () => (
  <Sidebar.Provider open={open} onOpenChange={(o: boolean) => void o} class="min-h-svh">
    <Sidebar side="left" variant="floating" collapsible="icon" class="x">
      <Sidebar.Header>
        <Sidebar.Input placeholder="Search" />
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Label</Sidebar.GroupLabel>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton isActive size="lg" variant="outline" tooltip="Home" href="/">
                Home
              </Sidebar.MenuButton>
              <Sidebar.MenuSub>
                <Sidebar.MenuSubItem>
                  <Sidebar.MenuSubButton size="sm" isActive>
                    Sub
                  </Sidebar.MenuSubButton>
                </Sidebar.MenuSubItem>
              </Sidebar.MenuSub>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Rail />
    </Sidebar>
    <Sidebar.Inset>
      <Sidebar.Trigger class="-ml-1" />
    </Sidebar.Inset>
  </Sidebar.Provider>
);

const props: Sidebar["MenuButtonProps"] = { children: "x", size: "sm" };
void props;

// @ts-expect-error unknown variant
export const badVariant = () => <Sidebar variant="glass">x</Sidebar>;

// @ts-expect-error unknown size
export const badSize = () => <Sidebar.MenuButton size="xl">x</Sidebar.MenuButton>;

// @ts-expect-error unknown collapsible
export const badCollapsible = () => <Sidebar collapsible="hidden">x</Sidebar>;
