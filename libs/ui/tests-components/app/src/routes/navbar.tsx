// Navbar on a resumed page (Rivet-authored; feature set inspired by HeroUI Pro's public Navbar docs): `#nb` sticky bar with
// `hideOnScroll` over a 3000 px page, `#nb-toggle` menu toggle, items `#nb-docs` (current) / `#nb-blog` / `#nb-action`
// (`onPress` → `#nb-pressed`), menu `[data-slot=navbar-menu]` with `#nb-menu-docs` / `#nb-menu-blog`; `onMenuOpenChange` → `#nb-state`.
// Nothing else on the page (the "no runtime boot at load" gate counts every `data-boot`).
import { signal } from "@rivetjs/reactivity";
import { Navbar } from "@rivetjs/ui/navbar";

export default function NavbarStories() {
  const state = signal("none");
  const pressed = signal(0);
  return (
    <div>
      <Navbar id="nb" aria-label="Main" hideOnScroll onMenuOpenChange={(open: boolean) => state.set(String(open))}>
        <Navbar.Header>
          <Navbar.MenuToggle id="nb-toggle" />
          <Navbar.Brand>Acme</Navbar.Brand>
          <Navbar.Content>
            <Navbar.Item id="nb-docs" href="/navbar#docs" isCurrent>
              Docs
            </Navbar.Item>
            <Navbar.Item id="nb-blog" href="/navbar#blog">
              Blog
            </Navbar.Item>
            <Navbar.Item id="nb-action" onPress={() => pressed.set(pressed() + 1)}>
              Action
            </Navbar.Item>
          </Navbar.Content>
        </Navbar.Header>
        <Navbar.Menu>
          <Navbar.MenuItem id="nb-menu-docs" href="/navbar#docs" isCurrent>
            Docs
          </Navbar.MenuItem>
          <Navbar.MenuItem id="nb-menu-blog" href="/navbar#blog">
            Blog
          </Navbar.MenuItem>
        </Navbar.Menu>
      </Navbar>
      <main class="p-6" style={{ height: "3000px" }}>
        <span id="nb-state">{state()}</span> <span id="nb-pressed">{pressed()}</span>
      </main>
    </div>
  );
}
