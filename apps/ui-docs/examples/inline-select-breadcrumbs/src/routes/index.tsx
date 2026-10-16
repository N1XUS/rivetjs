// Rivet-authored InlineSelect demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "InlineSelect: Breadcrumb Switcher" };

// #region demo
export function BreadcrumbSwitcher() {
  const project = signal<string | number | null>("web");
  return (
    <Breadcrumbs>
      <Breadcrumbs.Item href="#">Acme</Breadcrumbs.Item>
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
                  <ListBox.Item id="web" textValue="Website">
                    Website
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="app" textValue="Mobile app">
                    Mobile app
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="api" textValue="Public API">
                    Public API
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </InlineSelect.Popover>
            </InlineSelect>
            {separator()}
          </>
        )}
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>Deployments</Breadcrumbs.Item>
    </Breadcrumbs>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <BreadcrumbSwitcher />
    </div>
  );
}
