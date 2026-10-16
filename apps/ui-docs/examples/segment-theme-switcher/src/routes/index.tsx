// Rivet-authored Segment demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Segment } from "@rivetjs/ui/segment";
import { Monitor, Moon, Sun } from "lucide";

export const head = { title: "Segment: Theme Switcher" };

// #region demo
export function ThemeSwitcher() {
  const theme = signal<string | null>("system");
  return (
    <div class="flex flex-col items-center gap-3">
      <Segment aria-label="Theme" selectedKey={theme} size="sm">
        <Segment.Item aria-label="Light" id="light">
          <Icon icon={Sun} />
        </Segment.Item>
        <Segment.Item aria-label="Dark" id="dark">
          <Icon icon={Moon} />
        </Segment.Item>
        <Segment.Item aria-label="System" id="system">
          <Icon icon={Monitor} />
        </Segment.Item>
      </Segment>
      <p class="text-xs text-muted">
        Preference: <span id="theme">{theme()}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ThemeSwitcher />
    </div>
  );
}
