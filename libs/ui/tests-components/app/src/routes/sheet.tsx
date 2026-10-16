// Sheet on a resumed page (Rivet-authored; feature set inspired by HeroUI Pro's public Sheet docs). `#sh-trigger` opens the
// bottom sheet `#sh-dialog` (handle `#sh-handle`, scrollable `#sh-scroll`, `#sh-inside`, `#sh-close`; `#sh-state` = last
// `onOpenChange`); `#sh-snap-trigger` → `#sh-snap` (snap points 0.3 / 0.6 / 1, `#sh-snap-point` = active point);
// `#sh-modeless-trigger` → non-modal `#sh-modeless` (`#sh-outside` counts presses in `#sh-outside-count`);
// `#sh-parent-trigger` → `#sh-parent` with a nested `#sh-child-trigger` → `#sh-child`; `#sh-right-trigger` → `#sh-right`.
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export default function SheetStories() {
  const last = signal("none");
  const point = signal("0.3");
  const outside = signal(0);
  return (
    <section class="flex flex-wrap gap-8 p-10">
      <span id="sh-state">{last()}</span>
      <span id="sh-snap-point">{point()}</span>
      <Button id="sh-outside" onPress={() => outside.set(outside() + 1)}>
        Outside <span id="sh-outside-count">{outside()}</span>
      </Button>
      <Sheet onOpenChange={(open: boolean) => last.set(String(open))}>
        <Sheet.Trigger id="sh-trigger">Open sheet</Sheet.Trigger>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog id="sh-dialog">
              <Sheet.Handle id="sh-handle" />
              <Sheet.Header>
                <Sheet.Heading>Trip details</Sheet.Heading>
              </Sheet.Header>
              <Sheet.Body id="sh-scroll" class="max-h-48">
                {Array.from({ length: 30 }, (_, i) => (
                  <p class="py-1">Stop {i + 1}</p>
                ))}
              </Sheet.Body>
              <Sheet.Footer>
                <Button id="sh-inside">Save</Button>
                <Sheet.Close id="sh-close">Done</Sheet.Close>
              </Sheet.Footer>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
      <Sheet snapPoints={[0.3, 0.6, 1]} onActiveSnapPointChange={(p: number | string | null) => point.set(String(p))}>
        <Sheet.Trigger id="sh-snap-trigger">Snap sheet</Sheet.Trigger>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog id="sh-snap" aria-label="Snap sheet">
              <Sheet.Handle id="sh-snap-handle" />
              <Sheet.Body>Drag between the points.</Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
      <Sheet isModal={false}>
        <Sheet.Trigger id="sh-modeless-trigger">Non-modal</Sheet.Trigger>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog id="sh-modeless" aria-label="Non-modal sheet">
              <Sheet.Handle />
              <Sheet.Body>The page stays usable.</Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
      <Sheet>
        <Sheet.Trigger id="sh-parent-trigger">Nested</Sheet.Trigger>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog id="sh-parent" aria-label="Parent sheet">
              <Sheet.Handle />
              <Sheet.Body>
                <Sheet.NestedRoot>
                  <Sheet.Trigger id="sh-child-trigger">Open nested</Sheet.Trigger>
                  <Sheet.Backdrop variant="transparent">
                    <Sheet.Content>
                      <Sheet.Dialog id="sh-child" aria-label="Nested sheet">
                        <Sheet.Handle />
                        <Sheet.Body>Nested content</Sheet.Body>
                      </Sheet.Dialog>
                    </Sheet.Content>
                  </Sheet.Backdrop>
                </Sheet.NestedRoot>
              </Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
      <Sheet placement="right">
        <Sheet.Trigger id="sh-right-trigger">Right</Sheet.Trigger>
        <Sheet.Backdrop variant="blur">
          <Sheet.Content>
            <Sheet.Dialog id="sh-right" aria-label="Right sheet">
              <Sheet.CloseTrigger />
              <Sheet.Header id="sh-right-header">
                <Sheet.Heading>Filters</Sheet.Heading>
              </Sheet.Header>
              <Sheet.Body>Right body</Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    </section>
  );
}
