// Rivet-authored ItemCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ItemCard } from "@rivetjs/ui/item-card";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "ItemCard: Without Icon" };

// #region demo
export function WithoutIcon() {
  return (
    <div id="ic-no-icon" class="flex w-full max-w-md flex-col gap-3">
      <ItemCard>
        <ItemCard.Content>
          <ItemCard.Title>Export data</ItemCard.Title>
          <ItemCard.Description>Download everything as JSON</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Button size="sm" variant="secondary">
            Export
          </Button>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Content>
          <ItemCard.Title>Delete workspace</ItemCard.Title>
          <ItemCard.Description>This cannot be undone</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Button size="sm" variant="danger">
            Delete
          </Button>
        </ItemCard.Action>
      </ItemCard>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithoutIcon />
    </div>
  );
}
