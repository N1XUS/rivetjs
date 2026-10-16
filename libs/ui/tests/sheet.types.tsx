// Type-level suite (`tsc -p libs/ui` only): `Sheet` root options (placement, snap points as numbers / CSS lengths, controlled
// `activeSnapPoint` signal, callbacks), parts + `class`, `Sheet["…Props"]`, `state` from `useOverlayState`, Dialog
// render-function children, generic `Sheet.Header<"section">`, `Sheet.NestedRoot`; errors: unknown placement / variant.
import { signal } from "@rivetjs/reactivity";

import { Sheet } from "../src/components/sheet/index.ts";
import { useOverlayState } from "../src/hooks/use-overlay-state.tsx";

export const ok = () => {
  const state = useOverlayState({ defaultOpen: false });
  const active = signal<number | string | null>(0.5);
  return (
    <Sheet
      state={state}
      placement="bottom"
      snapPoints={[0.5, "148px", 1]}
      activeSnapPoint={active}
      onActiveSnapPointChange={(p) => void p}
      fadeFromIndex={1}
      closeThreshold={0.3}
      snapToSequentialPoint
      isHandleOnly
      isDetached
      isModal
      shouldScaleBackground
      shouldAutoFocus
      onDrag={(e, pct) => void [e.clientY, pct]}
      onRelease={(e, open) => void [e.pointerId, open]}
      onAnimationEnd={(open) => void open}
      onClose={() => {}}
    >
      <Sheet.Trigger class="t" onPress={() => {}}>
        t
      </Sheet.Trigger>
      <Sheet.Backdrop variant="blur" class="b">
        <Sheet.Content class="c">
          <Sheet.Dialog class="d">
            {({ close }) => (
              <>
                <Sheet.Handle preventCycle />
                <Sheet.CloseTrigger />
                <Sheet.Header<"section"> render={(p) => <section {...p} />}>
                  <Sheet.Heading>T</Sheet.Heading>
                </Sheet.Header>
                <Sheet.Body>b</Sheet.Body>
                <Sheet.Footer>
                  <Sheet.Close>Done</Sheet.Close>
                  <button onClick={() => close()}>x</button>
                </Sheet.Footer>
                <Sheet.NestedRoot>
                  <Sheet.Trigger>nested</Sheet.Trigger>
                </Sheet.NestedRoot>
              </>
            )}
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
};

export const props: [Sheet["Props"], Sheet["BackdropProps"], Sheet["HandleProps"]] = [
  { placement: "left" },
  { variant: "transparent" },
  { preventCycle: true },
];

// @ts-expect-error unknown placement
export const badPlacement = () => <Sheet placement="middle" />;
// @ts-expect-error unknown backdrop variant
export const badVariant = () => <Sheet.Backdrop variant="glass" />;
