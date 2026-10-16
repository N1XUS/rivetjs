// Rivet addition (no upstream demo): TagGroup shorthand, same parts as the compound form.
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "TagGroup: Shorthand" };

// #region demo
export function Shorthand() {
  const amenities = [
    { id: "laundry", name: "Laundry" },
    { id: "fitness", name: "Fitness center" },
    { id: "pool", name: "Swimming pool" },
  ];

  return (
    <TagGroup label="Amenities" description="Pick any" selectionMode="multiple" items={amenities}>
      {(item: { id: string; name: string }) => <Tag id={item.id}>{item.name}</Tag>}
    </TagGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
