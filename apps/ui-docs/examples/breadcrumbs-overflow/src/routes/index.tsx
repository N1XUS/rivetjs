// Rivet-authored Breadcrumbs demo (Rivet addition: HeroUI Breadcrumbs never collapse; React Spectrum's collapsing).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Breadcrumbs, type BreadcrumbsOverflowItem } from "@rivetjs/ui/breadcrumbs";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";
import { Ellipsis } from "lucide";

export const head = { title: "Breadcrumbs: Overflow" };

// #region demo
export function CollapsingTrail() {
  const opened = signal("none");
  return (
    <div class="grid gap-3">
      {/* Drag the corner: the trail re-measures on every resize. */}
      <div class="w-[340px] max-w-full resize-x overflow-hidden rounded-xl border border-border p-3">
        <Breadcrumbs
          overflowMode="collapse"
          showRoot
          renderOverflow={(items) => (
            <Dropdown>
              <Button variant="ghost" size="sm" isIconOnly aria-label="Show hidden pages">
                <Icon icon={Ellipsis} size={16} />
              </Button>
              <Dropdown.Popover placement="bottom start">
                <Dropdown.Menu items={items} onAction={(key) => opened.set(items.find((i) => i.key === key)?.textValue ?? "none")}>
                  {(item: BreadcrumbsOverflowItem) => (
                    <Dropdown.Item id={item.key} href={item.href} textValue={item.textValue}>
                      <Label>{item.textValue}</Label>
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        >
          <Breadcrumbs.Item id="home" href="#home">
            Home
          </Breadcrumbs.Item>
          <Breadcrumbs.Item id="docs" href="#docs">
            Documentation
          </Breadcrumbs.Item>
          <Breadcrumbs.Item id="components" href="#components">
            Components
          </Breadcrumbs.Item>
          <Breadcrumbs.Item id="navigation" href="#navigation">
            Navigation
          </Breadcrumbs.Item>
          <Breadcrumbs.Item id="breadcrumbs">Breadcrumbs</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>
      <p id="opened-page" class="text-sm text-muted">
        Opened: {opened()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CollapsingTrail />
    </div>
  );
}
