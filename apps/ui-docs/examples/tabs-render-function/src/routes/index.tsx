// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tabs/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Tabs } from "@rivetjs/ui/tabs";

export const head = { title: "Tabs: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <Tabs class="w-full max-w-md" render={(props: Record<string, any>) => <div {...props} data-custom="foo" />}>
      <Tabs.List aria-label="Options">
        <Tabs.Tab href="/docs/react/getting-started" id="getting-started" render={(domProps: Record<string, any>) => <a {...domProps} />}>
          Getting Started
        </Tabs.Tab>
        <Tabs.Tab href="/docs/react/components" id="components" render={(domProps: Record<string, any>) => <a {...domProps} />}>
          Components
        </Tabs.Tab>
        <Tabs.Tab href="/docs/react/releases" id="releases" render={(domProps: Record<string, any>) => <a {...domProps} />}>
          Releases
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel class="pt-4" id="overview">
        {() => <p>View your project overview and recent activity.</p>}
      </Tabs.Panel>
      <Tabs.Panel class="pt-4" id="analytics">
        {() => <p>Track your metrics and analyze performance data.</p>}
      </Tabs.Panel>
      <Tabs.Panel class="pt-4" id="reports">
        {() => <p>Generate and download detailed reports.</p>}
      </Tabs.Panel>
    </Tabs>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
