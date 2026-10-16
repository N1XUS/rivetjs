// Type-level suite (`tsc -p libs/ui` only): `Morph` props (state, direction, variant, animation, div attributes), parts,
// `Morph["…Props"]`, `useMorph`; errors: unknown direction / variant.
import { signal } from "@rivetjs/reactivity";

import { Morph, useMorph } from "../src/components/morph/index.ts";

export const ok = () => {
  const open = signal(false);
  return (
    <Morph isOpen={open} onOpenChange={(o: boolean) => void o} direction="bottom-end" variant="secondary" animation={{ duration: 12 }} class="c" id="x">
      <Morph.CollapsedContent class="p">
        <Morph.Trigger aria-label="View bag">View</Morph.Trigger>
      </Morph.CollapsedContent>
      <Morph.ExpandedContent aria-label="Summary" class="w-80" surfaceClass="s">
        <Morph.Close variant="tertiary" size="sm">
          Keep shopping
        </Morph.Close>
      </Morph.ExpandedContent>
    </Morph>
  );
};

export const flags = () => <Morph defaultOpen isDisabled animation="disabled" />;

export const props: Morph["Props"] = { direction: "top" };
export const hook = () => useMorph().isOpen();

// @ts-expect-error unknown direction
export const badDirection = () => <Morph direction="diagonal" />;

// @ts-expect-error unknown variant
export const badVariant = () => <Morph variant="tertiary" />;
