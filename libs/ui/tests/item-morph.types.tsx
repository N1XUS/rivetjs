// Type-level suite (`tsc -p libs/ui` only): `ItemMorph` props (morph, backdrop, classes, render-function children with the
// key accessor), `ItemMorph.Close` (ui Button props), `useItemMorph` options, `ItemMorph["…Props"]`; errors: missing
// `morph`, unknown backdrop / trigger, JSX (not a function) children.
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/listbox";

import { ItemMorph, itemMorphProps, useItemMorph, useItemMorphPanel } from "../src/components/item-morph/index.ts";

export const ok = () => {
  const openKey = signal<Key | null>(null);
  const m = useItemMorph({ trigger: ["longPress", "contextMenu"], threshold: 400, openKey, onOpenChange: (k: Key | null) => void k, duration: 12 });
  const bag: Record<string, unknown> = itemMorphProps(m);
  return (
    <ItemMorph morph={m} backdrop="opaque" class="c" panelClass="w-80" aria-label="Preview">
      {(key: () => Key | null) => (
        <ItemMorph.Close variant="tertiary" size="sm" onPress={() => void bag}>
          Close {String(key())}
        </ItemMorph.Close>
      )}
    </ItemMorph>
  );
};

export const hook = () => useItemMorphPanel().close();
export const props: ItemMorph["Props"] = { morph: useItemMorph(), children: () => null };

// @ts-expect-error morph is required
export const noMorph = () => <ItemMorph>{() => null}</ItemMorph>;
export const badBackdrop = () => (
  <ItemMorph
    morph={useItemMorph()}
    // @ts-expect-error unknown backdrop
    backdrop="frosted"
  >
    {() => null}
  </ItemMorph>
);
// @ts-expect-error unknown trigger
export const badTrigger = () => useItemMorph({ trigger: "hover" });
