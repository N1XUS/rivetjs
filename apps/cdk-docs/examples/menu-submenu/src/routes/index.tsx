import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger, SubmenuTrigger, type Key } from "@rivetjs/cdk/menu";
import { ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Menu submenus" };

// #region demo
export default function Submenus() {
  const last = signal<Key | null>(null);
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <MenuTrigger>
        <Button id="sub-trigger">Actions</Button>
        <Popover>
          <Menu id="sub" onAction={(key) => last.set(key)}>
            <MenuItem id="cut">Cut</MenuItem>
            <MenuItem id="copy">Copy</MenuItem>
            <MenuItem id="delete">Delete</MenuItem>
            {/* SubmenuTrigger: the trigger MenuItem, then the Popover with the submenu. */}
            <SubmenuTrigger>
              <MenuItem id="share" textValue="Share" class="flex items-center justify-between gap-6">
                Share
                <Icon icon={ChevronRight} class="text-slate-500" />
              </MenuItem>
              <Popover>
                <Menu onAction={(key) => last.set(key)}>
                  <MenuItem id="sms">SMS</MenuItem>
                  <MenuItem id="instagram">Instagram</MenuItem>
                  {/* Submenus nest: a SubmenuTrigger inside a submenu. */}
                  <SubmenuTrigger delay={0}>
                    <MenuItem id="email" textValue="Email" class="flex items-center justify-between gap-6">
                      Email
                      <Icon icon={ChevronRight} class="text-slate-500" />
                    </MenuItem>
                    <Popover>
                      <Menu onAction={(key) => last.set(key)}>
                        <MenuItem id="work">Work</MenuItem>
                        <MenuItem id="personal">Personal</MenuItem>
                      </Menu>
                    </Popover>
                  </SubmenuTrigger>
                </Menu>
              </Popover>
            </SubmenuTrigger>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p>
        Last action: <output id="sub-value">{last() ?? "nothing yet"}</output>
      </p>
    </section>
  );
}
// #endregion
