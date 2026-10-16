import { Button } from "@rivetjs/cdk/button";
import { Portal, PortalProvider } from "@rivetjs/cdk/portal";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";

export const head = { title: "PortalProvider" };

// #region demo
export default function Panel() {
  return (
    <section class="m-4 mt-10 grid gap-3 text-sm">
      {/* A function child: the components below are created under the provider. */}
      <PortalProvider container="#panel-layer">
        {() => (
          <div class="flex gap-2">
            <TooltipTrigger>
              <Button id="pp-button">Tooltip</Button>
              <Tooltip id="pp-tip">Rendered in #panel-layer</Tooltip>
            </TooltipTrigger>
            <Portal>
              <p id="pp-note" class="m-0 text-slate-500">
                A Portal in #panel-layer too.
              </p>
            </Portal>
          </div>
        )}
      </PortalProvider>
      <div id="panel-layer" class="relative rounded border border-dashed border-slate-300 p-2" />
    </section>
  );
}
// #endregion
