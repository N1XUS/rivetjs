// Rivet-authored CellSwitch demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Card } from "@rivetjs/ui/card";
import { Chip } from "@rivetjs/ui/chip";
import { CellSwitch } from "@rivetjs/ui/cell-switch";

export const head = { title: "CellSwitch: Feature Announcement" };

// #region demo
export function FeatureAnnouncement() {
  return (
    <Card id="cs-feature" class="w-full max-w-sm">
      <Card.Header>
        <div class="flex items-center gap-2">
          <Card.Title>Smart replies</Card.Title>
          <Chip size="sm" color="accent" variant="soft">
            Beta
          </Chip>
        </div>
        <Card.Description>Suggested answers appear above the composer, based on the last message in the thread.</Card.Description>
      </Card.Header>
      <Card.Content>
        <CellSwitch variant="secondary" label="Show suggestions" description="You can turn this off at any time" />
      </Card.Content>
    </Card>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <FeatureAnnouncement />
    </div>
  );
}
