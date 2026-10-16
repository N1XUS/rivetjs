// UI-COLD: one InlineSelect alone on a resumed page (cold-path bench target `inline-select`): `#isc` wrapper, two-way value → `#isc-value`.
import { signal } from "@rivetjs/reactivity";
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";

export default function InlineSelectCold() {
  const project = signal<string | number | null>("web");
  return (
    <section class="flex flex-col gap-8 p-10">
      <div id="isc">
        <InlineSelect value={project} aria-label="Project">
          <InlineSelect.Trigger>
            <InlineSelect.Value />
            <InlineSelect.Indicator />
          </InlineSelect.Trigger>
          <InlineSelect.Popover>
            <ListBox>
              <ListBox.Item id="web" textValue="Website">
                Website
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="app" textValue="Mobile app">
                Mobile app
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </InlineSelect.Popover>
        </InlineSelect>
      </div>
      <output id="isc-value">{String(project())}</output>
    </section>
  );
}
