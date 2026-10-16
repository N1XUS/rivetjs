import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosurePanel } from "@rivetjs/cdk/disclosure";
import { ShoppingCart } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Disclosure content" };

// #region demo
export default function Order() {
  const quantity = signal(1);
  return (
    <section class="m-4 max-w-md text-sm">
      <Disclosure id="order" defaultExpanded>
        <Heading level={3}>
          <Button slot="trigger" class="rv-Button inline-flex items-center gap-2">
            <Icon icon={ShoppingCart} class="size-4" />
            Order summary
            <span id="badge" class="rounded-full bg-slate-200 px-2 text-xs">
              {quantity()} item{quantity() === 1 ? "" : "s"}
            </span>
          </Button>
        </Heading>
        <DisclosurePanel>
          <p>Interactive content belongs in the panel, not in the trigger.</p>
          <button id="add" type="button" class="rv-Button" onClick={() => quantity.set(quantity() + 1)}>
            Add one
          </button>
        </DisclosurePanel>
      </Disclosure>
    </section>
  );
}
// #endregion
