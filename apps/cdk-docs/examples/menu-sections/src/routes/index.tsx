import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Header } from "@rivetjs/cdk/header";
import { Separator } from "@rivetjs/cdk/separator";
import { Menu, MenuItem, MenuSection, MenuTrigger, type Key } from "@rivetjs/cdk/menu";

export const head = { title: "Menu sections and separators" };

// #region demo
export default function Sections() {
  const last = signal<Key | null>(null);
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <MenuTrigger>
        <Button id="sec-trigger">Publish</Button>
        <Popover>
          <Menu id="sec" onAction={(key) => last.set(key)}>
            {/* A Header labels its section (aria-labelledby). */}
            <MenuSection id="export">
              <Header>Export</Header>
              <MenuItem id="image">Image…</MenuItem>
              <MenuItem id="video">Video…</MenuItem>
            </MenuSection>
            <MenuSection id="share">
              <Header>Share</Header>
              <MenuItem id="youtube">YouTube…</MenuItem>
              <MenuItem id="email">Email…</MenuItem>
            </MenuSection>
            {/* A Separator groups without a label; it is skipped by the keyboard. */}
            <Separator />
            {/* A section without a Header needs an aria-label. */}
            <MenuSection id="settings" aria-label="Settings">
              <MenuItem id="print">Print…</MenuItem>
            </MenuSection>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p>
        Last action: <output id="sec-value">{last() ?? "nothing yet"}</output>
      </p>
    </section>
  );
}
// #endregion
