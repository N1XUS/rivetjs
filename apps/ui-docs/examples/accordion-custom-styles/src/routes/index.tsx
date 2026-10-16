// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/accordion/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown } from "lucide";
import { Accordion } from "@rivetjs/ui/accordion";
import iconBellImage from "../assets/icon-bell.png?image";
import iconCatBadgeImage from "../assets/icon-cat-badge.png?image";
import iconCompassImage from "../assets/icon-compass.png?image";

export const head = { title: "Accordion: Tailwind CSS" };

// #region demo
const items = [
  {
    content: "Stay informed about your account activity with real-time notifications.",
    iconUrl: iconBellImage.src,
    subtitle: "Receive account activity updates",
    title: "Set Up Notifications",
  },
  {
    content: "Enhance your browsing experience by installing our official browser extension",
    iconUrl: iconCompassImage.src,
    subtitle: "Connect your browser to your account",
    title: "Set up Browser Extension",
  },
  {
    content: "Begin your journey into the world of digital collectibles by creating your first NFT. ",
    iconUrl: iconCatBadgeImage.src,
    subtitle: "Create your first collectible",
    title: "Mint Collectible",
  },
];

export function CustomStyles() {
  return (
    <Accordion class="bg-surface-1/10 w-full max-w-md rounded-2xl" variant="surface">
      {items.map((item, index) => (
        <Accordion.Item class="group/item first:**:data-[slot=accordion-trigger]:rounded-t-2xl last:[&:not(:has([data-slot=accordion-trigger][aria-expanded='true']))_[data-slot=accordion-trigger]]:rounded-b-2xl">
          <Accordion.Heading>
            <Accordion.Trigger class="group flex items-center gap-2 transition-none hover:bg-surface">
              {item.iconUrl ? (
                <img
                  alt={item.title}
                  class="h-11 w-11 transition-[scale,rotate] duration-300 ease-out group-hover/item:scale-120 group-hover/item:-rotate-10 group-hover/item:drop-shadow-lg"
                  src={item.iconUrl}
                />
              ) : null}
              <div class="flex flex-col gap-0">
                <span class="leading-5 font-medium">{item.title}</span>
                <span class="leading-6 font-normal text-muted/80">{item.subtitle}</span>
              </div>
              <Accordion.Indicator class="text-muted/50 [&>svg]:size-4">
                <Icon icon={ChevronDown} />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body class="text-muted/80">{item.content}</Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
