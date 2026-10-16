// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tag-group/with-list-data.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { Description } from "@rivetjs/ui/description";
import { EmptyState } from "@rivetjs/ui/empty-state";
import type { Key } from "@rivetjs/cdk/tag-group";
import { createListData } from "@rivetjs/cdk/data";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";
import avatarBlackImage from "../assets/avatar-black.jpg?image";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarOrangeImage from "../assets/avatar-orange.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";
import avatarRedImage from "../assets/avatar-red.jpg?image";

export const head = { title: "TagGroup: With List Data" };

// #region demo
export function TagGroupWithListData() {
  type User = {
    id: string;
    name: string;
    avatar: string;
    fallback: string;
  };

  const list = createListData<User>({
    getKey: (item) => item.id,
    initialItems: [
      {
        avatar: avatarBlueImage.src,
        fallback: "F",
        id: "fred",
        name: "Fred",
      },
      {
        avatar: avatarGreenImage.src,
        fallback: "M",
        id: "michael",
        name: "Michael",
      },
      {
        avatar: avatarPurpleImage.src,
        fallback: "J",
        id: "jane",
        name: "Jane",
      },
      {
        avatar: avatarRedImage.src,
        fallback: "A",
        id: "alice",
        name: "Alice",
      },
      {
        avatar: avatarOrangeImage.src,
        fallback: "B",
        id: "bob",
        name: "Bob",
      },
      {
        avatar: avatarBlackImage.src,
        fallback: "C",
        id: "charlie",
        name: "Charlie",
      },
    ],
    initialSelectedKeys: new Set(["fred", "michael"]),
  });

  const onRemove = (keys: Set<Key>) => {
    list.remove(...keys);
  };

  return (
    <div class="w-sm">
      <TagGroup selectedKeys={list.selectedKeys} selectionMode="multiple" onRemove={onRemove}>
        <Label>Team Members</Label>
        <TagGroup.List items={list.items} renderEmptyState={() => <EmptyState class="p-1">No team members</EmptyState>}>
          {(user: User) => (
            <Tag id={user.id} textValue={user.name}>
              <Avatar class="size-4" size="sm">
                <Avatar.Image src={user.avatar} />
                <Avatar.Fallback>{user.fallback}</Avatar.Fallback>
              </Avatar>
              {user.name}
            </Tag>
          )}
        </TagGroup.List>
        <Description>Select team members for your project</Description>
      </TagGroup>
      {list.selectedKeys() !== "all" && Array.from(list.selectedKeys()).length > 0 && (
        <div class="mt-4 flex flex-col gap-2">
          <p class="text-sm font-medium text-muted">Selected:</p>
          <div class="flex flex-wrap gap-2">
            {Array.from(list.selectedKeys() as Set<Key>).map((key) => {
              const user = list.getItem(key);

              if (!user) return null;

              return (
                <div class="flex items-center gap-2 rounded-lg bg-surface-tertiary px-2 py-1">
                  <Avatar class="size-4" size="sm">
                    <Avatar.Image src={user.avatar} />
                    <Avatar.Fallback>{user.fallback}</Avatar.Fallback>
                  </Avatar>
                  <span class="text-sm">{user.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TagGroupWithListData />
    </div>
  );
}
