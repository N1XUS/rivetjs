// Rivet-authored Compare demo (Rivet addition): the same card in the light and the dark theme.
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Chip } from "@rivetjs/ui/chip";
import { Compare } from "@rivetjs/ui/compare";

export const head = { title: "Compare: Content" };

// #region demo
function Preview(props: { theme: "light" | "dark" }) {
  return (
    <div data-theme={props.theme} class="flex h-full items-center justify-center bg-background p-6 text-foreground">
      <Card class="w-full max-w-xs">
        <Card.Header>
          <Card.Title>Weekly report</Card.Title>
          <Card.Description>Signups grew 12% since last week.</Card.Description>
        </Card.Header>
        <Card.Footer class="flex items-center justify-between gap-2">
          <Chip color="success" size="sm">
            +12%
          </Chip>
          <Button size="sm">Open</Button>
        </Card.Footer>
      </Card>
    </div>
  );
}

export function CompareContent() {
  return (
    <Compare id="compare-content" class="h-72 w-[min(32rem,100%)]">
      <Compare.Before>
        <Preview theme="light" />
        <Compare.Label placement="start">Light</Compare.Label>
      </Compare.Before>
      <Compare.After>
        <Preview theme="dark" />
        <Compare.Label placement="end">Dark</Compare.Label>
      </Compare.After>
      <Compare.Handle id="compare-content-handle" aria-label="Light versus dark theme" />
    </Compare>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CompareContent />
    </div>
  );
}
