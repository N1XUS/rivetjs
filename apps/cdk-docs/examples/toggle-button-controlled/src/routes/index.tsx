import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { Star } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Controlled and uncontrolled ToggleButton" };

// #region demo
export default function Toggles() {
  const pinned = signal(false);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div class="flex flex-wrap items-center gap-2">
        {/* Controlled: the signal is the state, both ways. */}
        <ToggleButton id="pin" isSelected={pinned}>
          Pin
        </ToggleButton>
        <Button id="unpin" onPress={() => pinned.set(false)}>
          Unpin from outside
        </Button>
        {/* Uncontrolled: starts pressed, keeps its own state. Icon content needs a name. */}
        <ToggleButton id="star" defaultSelected aria-label="Favourite">
          <Icon icon={Star} />
        </ToggleButton>
      </div>
      <p id="pin-state">Pinned: {pinned() ? "yes" : "no"}</p>
    </section>
  );
}
// #endregion
