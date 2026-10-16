// Rivet addition (no upstream demo): the brand gradient variant.
import { Button } from "@rivetjs/ui/button";
import { Icon } from "@rivetjs/kit/icon";
import { ArrowRight } from "lucide";

export const head = { title: "Button: Brand" };

// #region demo
export function Brand() {
  return (
    <div class="flex flex-wrap items-center gap-3">
      <Button variant="brand" size="sm">
        Get started
      </Button>
      <Button variant="brand">
        Get started
        <Icon icon={ArrowRight} />
      </Button>
      <Button variant="brand" size="lg">
        Get started
      </Button>
      <Button variant="brand" isDisabled>
        Disabled
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Brand />
    </div>
  );
}
