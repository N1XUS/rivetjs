import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Modal, ModalOverlay } from "@rivetjs/cdk/modal";
import { Menu, X } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { areas, sections } from "virtual:docs/nav";
import { SideNav } from "./SideNav.tsx";
import { areaOf, topItems } from "./nav.ts";
import { currentPath } from "./browser.ts";

/** Drawer content: the top-bar sections + the side nav of the current page's area, rendered on open. */
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

/**
 * Mobile navigation: the bar's menu button opens a modal drawer (cdk Modal on the div overlay layer:
 * focus trap, Escape, outside press, scroll lock, focus restore) holding the sections and the side
 * nav. Its content is a render function, created in the browser when the drawer opens (nothing of it
 * is in the page HTML).
 */
export function MobileMenu() {
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
