// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar/fallback.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { User } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";

export const head = { title: "Avatar: Fallback Content" };

// #region demo
// Rivet: upstream's broken image URL (`https://invalid-url-to-show-fallback.com/image.jpg`) logs a failed network
// request; an undecodable data URL fails the same way without one (the example checks fail on console errors).
export function Fallback() {
  return (
    <div class="flex items-center gap-4">
      {/* Text fallback */}
      <Avatar>
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar>

      {/* Icon fallback */}
      <Avatar>
        <Avatar.Fallback>
          <Icon icon={User} size={16} />
        </Avatar.Fallback>
      </Avatar>

      {/* Fallback with delay */}
      <Avatar>
        <Avatar.Image alt="Delayed Avatar" src="data:image/png;base64,invalid" />
        <Avatar.Fallback delayMs={600}>NA</Avatar.Fallback>
      </Avatar>

      {/* Custom styled fallback */}
      <Avatar>
        <Avatar.Fallback class="border-none bg-gradient-to-br from-pink-500 to-purple-500 text-white">GB</Avatar.Fallback>
      </Avatar>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Fallback />
    </div>
  );
}
