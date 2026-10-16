// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tag-group/with-prefix.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Globe, Newspaper, Rocket, ShoppingBag } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";

export const head = { title: "TagGroup: With Prefix" };

// #region demo
export function TagGroupWithPrefix() {
  return (
    <div class="flex flex-col gap-8">
      <TagGroup selectionMode="single">
        <Label>With Icons</Label>
        <TagGroup.List>
          <Tag textValue="News">
            <Icon icon={Newspaper} size={16} />
            News
          </Tag>
          <Tag textValue="Travel">
            <Icon icon={Globe} size={16} />
            Travel
          </Tag>
          <Tag textValue="Gaming">
            <Icon icon={Rocket} size={16} />
            Gaming
          </Tag>
          <Tag textValue="Shopping">
            <Icon icon={ShoppingBag} size={16} />
            Shopping
          </Tag>
        </TagGroup.List>
        <Description>Tags with icons</Description>
      </TagGroup>

      <TagGroup selectionMode="single">
        <Label>With Avatars</Label>
        <TagGroup.List>
          <Tag textValue="F Fred">
            <Avatar class="size-4">
              <Avatar.Image src={avatarBlueImage.src} />
              <Avatar.Fallback>F</Avatar.Fallback>
            </Avatar>
            Fred
          </Tag>
          <Tag textValue="M Michael">
            <Avatar class="size-4">
              <Avatar.Image src={avatarGreenImage.src} />
              <Avatar.Fallback>M</Avatar.Fallback>
            </Avatar>
            Michael
          </Tag>
          <Tag textValue="J Jane">
            <Avatar class="size-4">
              <Avatar.Image src={avatarPurpleImage.src} />
              <Avatar.Fallback>J</Avatar.Fallback>
            </Avatar>
            Jane
          </Tag>
        </TagGroup.List>
        <Description>Tags with avatars</Description>
      </TagGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TagGroupWithPrefix />
    </div>
  );
}
