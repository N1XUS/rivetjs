// Morph on a resumed page (Rivet-authored; feature set inspired by HeroUI Pro's public MorphButton docs): `#bag` the bag pill
// (CollapsedContent + Trigger `#bag-view`) → "Order summary" panel (`#bag-panel`; Close `#bag-keep`, `#bag-buy` counts
// `#bag-bought`); `#still` animation disabled; `#sec` secondary + direction bottom-end; `#after` a sibling below (layout never moves).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Morph } from "@rivetjs/ui/morph";
import { ShoppingBag } from "lucide";

export default function MorphStories() {
  const bought = signal(0);
  return (
    <main class="flex min-h-[90vh] flex-col items-center justify-end gap-10 p-6">
      <p id="bag-bought">{bought()}</p>
      <Morph id="still" animation="disabled">
        <Morph.CollapsedContent>
          No motion
          <Morph.Trigger id="still-view">View</Morph.Trigger>
        </Morph.CollapsedContent>
        <Morph.ExpandedContent aria-label="Still panel" class="w-60">
          <p>Jumps</p>
          <Morph.Close id="still-close" size="sm">
            Close
          </Morph.Close>
        </Morph.ExpandedContent>
      </Morph>
      <Morph id="sec" variant="secondary" direction="bottom-end">
        <Morph.CollapsedContent>
          Bottom end
          <Morph.Trigger id="sec-view">More</Morph.Trigger>
        </Morph.CollapsedContent>
        <Morph.ExpandedContent aria-label="Details" class="w-72">
          <p>Grows down and to the end.</p>
          <Morph.Close id="sec-close" size="sm" variant="secondary">
            Close
          </Morph.Close>
        </Morph.ExpandedContent>
      </Morph>
      <Morph id="bag">
        <Morph.CollapsedContent>
          <Icon icon={ShoppingBag} size={16} />
          <span>1 item in bag</span>
          <Morph.Trigger id="bag-view">View</Morph.Trigger>
        </Morph.CollapsedContent>
        <Morph.ExpandedContent id="bag-panel" aria-label="Order summary" class="w-80">
          <h2 class="text-base font-semibold">Order summary</h2>
          <div class="flex justify-between text-sm">
            <span class="opacity-70">1 × Fieldline Runner</span>
            <span>$128</span>
          </div>
          <div class="flex justify-between font-semibold">
            <span>Subtotal</span>
            <span>$128</span>
          </div>
          <div class="flex gap-2">
            <Morph.Close id="bag-keep" size="sm" variant="tertiary" class="flex-1">
              Keep shopping
            </Morph.Close>
            <Button id="bag-buy" size="sm" class="flex-1" onPress={() => bought.set(bought() + 1)}>
              Buy now
            </Button>
          </div>
        </Morph.ExpandedContent>
      </Morph>
      <button id="after" type="button">
        Below the bag
      </button>
    </main>
  );
}
