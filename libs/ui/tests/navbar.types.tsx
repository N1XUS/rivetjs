// Type-level suite (`tsc -p libs/ui` only): `Navbar` root options, parts + `class`, items as links (`href`) or buttons
// (`onPress`), `isCurrent` value / accessor, `Navbar["…Props"]`, generic `Navbar.Brand<"a">`, `useNavbar`; errors: unknown
// position / size / maxWidth.
import { signal } from "@rivetjs/reactivity";

import { Navbar, useNavbar } from "../src/components/navbar/index.ts";

export const ok = () => {
  const open = signal(false);
  const current = signal(true);
  return (
    <Navbar
      position="floating"
      size="sm"
      maxWidth="xl"
      height="3.5rem"
      hideOnScroll
      isMenuOpen={open}
      onMenuOpenChange={(o) => void o}
      shouldBlockScroll={false}
      navigate={(path, options) => void [path, options]}
      useHref={(href) => href}
      aria-label="Main"
    >
      <Navbar.Header class="h">
        <Navbar.MenuToggle srLabel="Menu" />
        <Navbar.Brand<"a"> render={(p) => <a {...p} href="/" />}>Acme</Navbar.Brand>
        <Navbar.Content>
          <Navbar.Item href="/docs" isCurrent={() => current()} forceReload>
            <Navbar.Label>Docs</Navbar.Label>
          </Navbar.Item>
          <Navbar.Item onPress={() => {}}>Action</Navbar.Item>
          <Navbar.Separator />
        </Navbar.Content>
        <Navbar.Spacer />
      </Navbar.Header>
      <Navbar.Menu>
        <Navbar.MenuItem href="/docs" isCurrent>
          Docs
        </Navbar.MenuItem>
      </Navbar.Menu>
    </Navbar>
  );
};

export const hook = () => {
  const nav = useNavbar();
  nav.setMenuOpen(!nav.isMenuOpen());
  return nav.isHidden() ? nav.height : null;
};

export const props: [Navbar["Props"], Navbar["ItemProps"]] = [{ position: "static" }, { href: "/", isCurrent: true }];

// @ts-expect-error unknown position
export const badPosition = () => <Navbar position="fixed" />;
// @ts-expect-error unknown size
export const badSize = () => <Navbar size="xl" />;
// @ts-expect-error unknown max width
export const badMax = () => <Navbar maxWidth="3xl" />;
