// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tag-group/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Globe, Newspaper, Rocket, ShoppingBag } from "lucide";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "TagGroup: Tailwind CSS" };

// #region demo
const tagClass =
  "group/tag gap-1.5 rounded-full border border-neutral-300/80 bg-white/80 px-2.5 py-1 text-sm font-medium text-neutral-700 shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-colors data-[selected=true]:border-neutral-500 data-[selected=true]:bg-neutral-900 data-[selected=true]:text-neutral-50 dark:border-neutral-600/80 dark:bg-neutral-900/60 dark:text-neutral-200 dark:ring-white/10 dark:data-[selected=true]:border-neutral-400 dark:data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:text-neutral-900";

const iconClass = "size-4 shrink-0 text-neutral-500 group-data-[selected=true]/tag:text-current dark:text-neutral-400";

export function CustomStyles() {
  return (
    <TagGroup aria-label="Topics" selectionMode="single">
      <TagGroup.List class="gap-2">
        <Tag class={tagClass} id="news" textValue="News">
          <Icon icon={Newspaper} size={16} class={iconClass} />
          News
        </Tag>
        <Tag class={tagClass} id="travel" textValue="Travel">
          <Icon icon={Globe} size={16} class={iconClass} />
          Travel
        </Tag>
        <Tag class={tagClass} id="gaming" textValue="Gaming">
          <Icon icon={Rocket} size={16} class={iconClass} />
          Gaming
        </Tag>
        <Tag class={tagClass} id="shopping" textValue="Shopping">
          <Icon icon={ShoppingBag} size={16} class={iconClass} />
          Shopping
        </Tag>
      </TagGroup.List>
    </TagGroup>
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
