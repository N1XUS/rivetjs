// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/switch/with-icons.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bell, BellOff, Check, Mic, MicOff, Moon, Power, Sun, Volume2, VolumeX } from "lucide";
import { Switch } from "@rivetjs/ui/switch";

export const head = { title: "Switch: With Icons" };

// #region demo
export function WithIcons() {
  const icons = {
    check: {
      off: Power,
      on: Check,
      selectedControlClass: "bg-green-500/80",
    },
    darkMode: {
      off: Moon,
      on: Sun,
      selectedControlClass: "",
    },
    microphone: {
      off: Mic,
      on: MicOff,
      selectedControlClass: "bg-red-500/80",
    },
    notification: {
      off: BellOff,
      on: Bell,
      selectedControlClass: "bg-purple-500/80",
    },
    volume: {
      off: Volume2,
      on: VolumeX,
      selectedControlClass: "bg-blue-500/80",
    },
  };

  return (
    <div class="flex gap-3">
      {Object.entries(icons).map(([key, value]) => (
        <Switch defaultSelected aria-label={key} size="lg">
          {({ isSelected }) => (
            <Switch.Content>
              <Switch.Control class={isSelected() ? value.selectedControlClass : ""}>
                <Switch.Thumb>
                  <Switch.Icon>
                    {isSelected() ? (
                      <Icon class="size-3 text-inherit opacity-100" icon={value.on} />
                    ) : (
                      <Icon class="size-3 text-inherit opacity-70" icon={value.off} />
                    )}
                  </Switch.Icon>
                </Switch.Thumb>
              </Switch.Control>
            </Switch.Content>
          )}
        </Switch>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithIcons />
    </div>
  );
}
