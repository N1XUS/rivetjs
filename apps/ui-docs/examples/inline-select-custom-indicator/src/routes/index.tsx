// Rivet-authored InlineSelect demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown } from "lucide";
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "InlineSelect: Custom Indicator" };

// #region demo
export function CustomIndicator() {
  return (
    <p class="text-sm">
      Sort by{" "}
      <InlineSelect defaultValue="recent" aria-label="Sort by">
        <InlineSelect.Trigger>
          <InlineSelect.Value />
          <InlineSelect.Indicator>
            <Icon icon={ChevronDown} size={14} />
          </InlineSelect.Indicator>
        </InlineSelect.Trigger>
        <InlineSelect.Popover>
          <ListBox>
            <ListBox.Item id="recent" textValue="Most recent">
              Most recent
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="popular" textValue="Most popular">
              Most popular
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="name" textValue="Name">
              Name
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </InlineSelect.Popover>
      </InlineSelect>
    </p>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIndicator />
    </div>
  );
}
