// Rivet-authored demo: one card rendered under a light and a dark theme scope at once.
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Chip } from "@rivetjs/ui/chip";
import { Input } from "@rivetjs/ui/input";
import { Switch } from "@rivetjs/ui/switch";
import { Moon, Sun } from "lucide";

export const head = { title: "Dark mode: Theme compare" };

// #region demo
const MODES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

export function ThemeCompare() {
  const saved = signal<Record<string, boolean>>({});
  return (
    <div class="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
      {MODES.map((mode) => (
        <section
          id={`tc-${mode.id}`}
          data-theme={mode.id}
          aria-label={`${mode.label} theme`}
          class="grid gap-3 rounded-3xl bg-background p-4 text-foreground [color-scheme:light] data-[theme=dark]:[color-scheme:dark]"
        >
          <p class="m-0 flex items-center gap-2 text-xs font-medium text-muted">
            <Icon icon={mode.icon} size={14} />
            <code class="font-mono">data-theme="{mode.id}"</code>
          </p>
          <Card>
            <Card.Header class="flex-row items-center gap-3">
              <Avatar size="sm" color="accent" variant="soft">
                <Avatar.Fallback>MV</Avatar.Fallback>
              </Avatar>
              <div class="flex flex-col">
                <Card.Title>Marisol Vey</Card.Title>
                <Card.Description>Workspace owner</Card.Description>
              </div>
              <Chip size="sm" color="success" class="ms-auto">
                Active
              </Chip>
            </Card.Header>
            <Card.Content class="gap-3">
              <Input aria-label={`Display name (${mode.label})`} defaultValue="Marisol" />
              <Switch defaultSelected class="w-full">
                <Switch.Content class="flex w-full items-center justify-between gap-4">
                  <span class="text-sm">Weekly summary</span>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </Card.Content>
            <Card.Footer class="gap-2">
              <Button size="sm" variant="secondary" class="flex-1">
                Cancel
              </Button>
              <Button id={`tc-${mode.id}-save`} size="sm" class="flex-1" onPress={() => saved.set({ ...saved(), [mode.id]: true })}>
                {saved()[mode.id] ? "Saved" : "Save"}
              </Button>
            </Card.Footer>
          </Card>
        </section>
      ))}
    </div>
  );
}
// #endregion

export default function Page() {
  return <ThemeCompare />;
}
