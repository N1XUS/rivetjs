// The live mobile navigation (RT-DIET2 DOCS-CHROME): fetched by the docs page script (`page-script.ts`) when the pointer
// or focus reaches the static `MobileMenu` button, mounted in its place on activation with the drawer open: the bar's
// menu button opens a modal drawer (cdk Modal on the div overlay layer: focus trap, Escape, outside press, scroll lock,
// focus restore) holding the sections and the side nav of the current page's area, rendered on open.
import { mount } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Modal, ModalOverlay } from "@rivetjs/cdk/modal";
import { Menu, X } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { areas, sections } from "virtual:docs/nav";
import { SideNav } from "./SideNav.tsx";
import { areaOf, topItems } from "./nav.ts";
import { currentPath } from "./browser.ts";
import { replayPress } from "./chrome-press.ts";

/** Drawer content: the top-bar sections + the side nav of the current page's area. */
function DrawerNav({ path }: { path: string }) {
  const area = areaOf(sections, path);
  return (
    <div class="drawer-body">
      <nav aria-label="Sections">
        <ul class="drawer-sections">
          {topItems(areas).map((item) => (
            <li>
              <a class="top-link" href={item.href} data-rivet-reload="" aria-current={item.id === area ? "true" : undefined}>
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {area && area !== "api" && area !== "examples" ? <SideNav sections={sections} area={area} path={path} label="Pages in this section" /> : null}
    </div>
  );
}

function MobileMenuLive() {
  return (
    <DialogTrigger>
      <Button class="top-icon menu-button" aria-label="Open navigation">
        <Icon icon={Menu} size={22} />
      </Button>
      <ModalOverlay isDismissable class="drawer-overlay">
        <Modal class="drawer">
          <Dialog class="drawer-dialog" aria-label="Site navigation">
            {() => (
              <>
                <Button slot="close" class="top-icon drawer-close" aria-label="Close navigation">
                  <Icon icon={X} size={20} />
                </Button>
                <DrawerNav path={currentPath()} />
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

const swapped = new WeakMap<HTMLButtonElement, HTMLButtonElement>();

/** Replace the static button by the live drawer trigger (closed; same markup), on pointer / focus intent (`liveThemeMenu`). */
export function liveMobileMenu(button: HTMLButtonElement): HTMLButtonElement {
  let live = swapped.get(button);
  if (live) return live;
  const fragment = document.createDocumentFragment();
  mount(() => <MobileMenuLive />, fragment);
  live = fragment.querySelector("button")!;
  swapped.set(button, live);
  const focused = document.activeElement === button;
  button.replaceWith(fragment);
  if (focused) live.focus();
  return live;
}

/** A click on the static button before its module: the live trigger, focused, is clicked (the drawer restores focus to it). */
export function openMobileMenu(button: HTMLButtonElement, click: MouseEvent): void {
  const live = liveMobileMenu(button);
  live.focus();
  replayPress(live, click);
}
