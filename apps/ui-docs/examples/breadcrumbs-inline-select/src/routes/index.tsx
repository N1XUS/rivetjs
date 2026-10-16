// Rivet-authored Breadcrumbs demo (Rivet addition: HeroUI has no InlineSelect breadcrumb demo).
import { computed, signal } from "@rivetjs/reactivity";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "Breadcrumbs: Inline Select" };

const projects = [
  { id: "storefront", name: "Storefront" },
  { id: "billing", name: "Billing service" },
  { id: "analytics", name: "Analytics" },
];

// #region demo
export function ProjectSwitcher() {
  const project = signal<string | number | null>("storefront");
  const name = computed(() => projects.find((p) => p.id === project())?.name ?? "");
  return (
    <div class="grid gap-4">
      <Breadcrumbs>
        <Breadcrumbs.Item href="#workspace">Workspace</Breadcrumbs.Item>
        {/* A function child replaces the item's link: the InlineSelect trigger is the breadcrumb, `separator()` keeps the chevron. */}
        <Breadcrumbs.Item>
          {({ separator }) => (
            <>
              <InlineSelect value={project} aria-label="Project">
                <InlineSelect.Trigger>
                  <InlineSelect.Value />
                  <InlineSelect.Indicator />
                </InlineSelect.Trigger>
                <InlineSelect.Popover>
                  <ListBox>
                    {projects.map((p) => (
                      <ListBox.Item id={p.id} textValue={p.name}>
                        {p.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </InlineSelect.Popover>
              </InlineSelect>
              {separator()}
            </>
          )}
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>Settings</Breadcrumbs.Item>
      </Breadcrumbs>
      <p id="project-settings" class="text-sm text-muted">
        Settings of {name()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ProjectSwitcher />
    </div>
  );
}
