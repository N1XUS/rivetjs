// Rivet-authored ItemCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { Switch } from "@rivetjs/ui/switch";
import { Moon, Volume2 } from "lucide";

export const head = { title: "ItemCard: Title Only" };

// #region demo
export function TitleOnly() {
  return (
    <div id="ic-title-only" class="flex w-full max-w-md flex-col gap-3">
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Moon} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Dark mode</ItemCard.Title>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label="Dark mode">
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Volume2} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Sounds</ItemCard.Title>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label="Sounds" defaultSelected>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </ItemCard.Action>
      </ItemCard>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <TitleOnly />
    </div>
  );
}
