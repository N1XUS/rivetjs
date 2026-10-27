// Rivet-authored ItemCardGroup demo (Rivet addition; collection mode on the cdk GridList, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroupCollection } from "@rivetjs/ui/item-card-group-collection";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { AudioLines, Bookmark, Podcast } from "lucide";

export const head = { title: "ItemCardGroup: Actions" };

// #region demo
const EPISODES = [
  { id: "e1", title: "Tide tables and other lies", length: "42 min" },
  { id: "e2", title: "Night shift at the bakery", length: "38 min" },
  { id: "e3", title: "The last lighthouse keeper", length: "51 min" },
];

export function Actions() {
  const playing = signal("e1");
  const saved = signal<string[]>([]);
  const title = () => EPISODES.find((e) => e.id === playing())?.title ?? "";
  return (
    <div class="flex w-full max-w-md flex-col gap-2">
      <ItemCardGroupCollection id="icg-episodes" aria-label="Episodes" onAction={(key) => playing.set(String(key))}>
        {EPISODES.map((e) => (
          <ItemCard id={e.id} textValue={e.title} isCurrent={() => playing() === e.id}>
            <ItemCard.Icon>
              <Icon icon={playing() === e.id ? AudioLines : Podcast} size={18} />
            </ItemCard.Icon>
            <ItemCard.Content>
              <ItemCard.Title>{e.title}</ItemCard.Title>
              <ItemCard.Description>{e.length}</ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
              <ToggleButton
                id={`icg-save-${e.id}`}
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={`Save ${e.title}`}
                isSelected={saved().includes(e.id)}
                onChange={(on: boolean) => saved.set(on ? [...saved(), e.id] : saved().filter((id) => id !== e.id))}
              >
                <Icon icon={Bookmark} size={16} />
              </ToggleButton>
            </ItemCard.Action>
          </ItemCard>
        ))}
      </ItemCardGroupCollection>
      <p id="icg-playing" class="text-sm text-muted">
        Playing: {title()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Actions />
    </div>
  );
}
