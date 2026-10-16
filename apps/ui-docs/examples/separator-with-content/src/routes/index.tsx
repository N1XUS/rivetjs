// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/separator/with-content.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Separator } from "@rivetjs/ui/separator";
import iconBellImage from "../assets/icon-bell.png?image";
import iconCatBadgeImage from "../assets/icon-cat-badge.png?image";
import iconCompassImage from "../assets/icon-compass.png?image";

export const head = { title: "Separator: With Content" };

// #region demo
const items = [
  {
    iconUrl: iconBellImage.src,
    subtitle: "Receive account activity updates",
    title: "Set Up Notifications",
  },
  {
    iconUrl: iconCompassImage.src,
    subtitle: "Connect your browser to your account",
    title: "Set up Browser Extension",
  },
  {
    iconUrl: iconCatBadgeImage.src,
    subtitle: "Create your first collectible",
    title: "Mint Collectible",
  },
];

export function WithContent() {
  return (
    <div class="max-w-md space-y-4">
      {items.map((item, index) => (
        <div>
          <div class="flex items-center gap-3">
            <img alt={item.title} class="size-12" src={item.iconUrl} />
            <div class="flex-1 space-y-0">
              <h4 class="text-small font-medium">{item.title}</h4>
              <p class="text-sm text-muted">{item.subtitle}</p>
            </div>
          </div>
          {index < items.length - 1 && <Separator class="my-4" />}
        </div>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithContent />
    </div>
  );
}
