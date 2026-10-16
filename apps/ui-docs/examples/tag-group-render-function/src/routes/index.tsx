// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tag-group/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Globe, Newspaper, Rocket, ShoppingBag } from "lucide";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "TagGroup: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <TagGroup aria-label="Tags" render={(props) => <div {...props} data-custom="foo" />} selectionMode="single">
      <TagGroup.List>
        <Tag id="default-news" textValue="News">
          <Icon icon={Newspaper} size={16} />
          News
        </Tag>
        <Tag id="default-travel" textValue="Travel">
          <Icon icon={Globe} size={16} />
          Travel
        </Tag>
        <Tag id="default-gaming" textValue="Gaming">
          <Icon icon={Rocket} size={16} />
          Gaming
        </Tag>
        <Tag id="default-shopping" textValue="Shopping">
          <Icon icon={ShoppingBag} size={16} />
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
      <RenderFunction />
    </div>
  );
}
