// Rivet-authored Morph demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Morph } from "@rivetjs/ui/morph";
import { Separator } from "@rivetjs/ui/separator";
import { ShoppingBag } from "lucide";

export const head = { title: "Morph: Usage" };

// #region demo
export function Basic() {
  return (
    <Morph id="morph-basic">
      <Morph.CollapsedContent>
        <Icon icon={ShoppingBag} size={16} />
        <span class="text-sm font-medium">2 items in bag</span>
        <Morph.Trigger id="morph-basic-view">View</Morph.Trigger>
      </Morph.CollapsedContent>
      <Morph.ExpandedContent id="morph-basic-panel" aria-label="Order summary" class="w-80">
        <h2 class="text-base font-semibold">Order summary</h2>
        <div class="flex flex-col gap-1.5 text-sm">
          <div class="flex justify-between">
            <span class="text-muted">1 × Tidewater linen shirt</span>
            <span>$68</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">1 × Harbor canvas tote</span>
            <span>$42</span>
          </div>
        </div>
        <Separator />
        <div class="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>$110</span>
        </div>
        <div class="flex gap-2">
          <Morph.Close id="morph-basic-keep" variant="tertiary" size="sm" class="flex-1">
            Keep shopping
          </Morph.Close>
          <Button size="sm" class="flex-1">
            Check out
          </Button>
        </div>
      </Morph.ExpandedContent>
    </Morph>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-end justify-center p-6 pb-10">
      <Basic />
    </div>
  );
}
