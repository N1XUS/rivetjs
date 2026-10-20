// UI-THEME-PORTAL: a server-rendered open Tooltip (`defaultOpen`) inside a scoped theme (`data-ui-theme="rivet"`): its portal
// host is in place in the server HTML (scope tokens apply) and moved to <body> at load, where the stamp keeps the scope
// (theme-scope.test.ts). Own route: an open overlay on the theme-scope page would take Escape / pointer from the others.
import { Button } from "@rivetjs/ui/button";
import { Tooltip } from "@rivetjs/ui/tooltip";

export default function ThemeScopeOpen() {
  return (
    <section class="p-16 pt-32">
      <div data-ui-theme="rivet" class="bg-background p-6 text-foreground">
        <Tooltip defaultOpen delay={0}>
          <Button id="ts-open">Open at load</Button>
          <Tooltip.Content id="ts-open-tip">Server-rendered open tip</Tooltip.Content>
        </Tooltip>
      </div>
    </section>
  );
}
