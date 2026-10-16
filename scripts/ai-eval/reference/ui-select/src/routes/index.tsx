import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Plan" };

export default function Home() {
  const plan = signal<string | number | null>(null);
  return (
    <main class="mx-auto max-w-xs p-6">
      <Select placeholder="Choose a plan" value={plan}>
        <Label>Plan</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="free" textValue="Free">
              Free
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="pro" textValue="Pro">
              Pro
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="team" textValue="Team">
              Team
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <p id="chosen" class="mt-4">
        Plan: {plan() ?? "none"}
      </p>
    </main>
  );
}
