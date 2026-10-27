// Rivet-authored FloatingToc demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { FloatingToc } from "@rivetjs/ui/floating-toc";

export const head = { title: "FloatingToc: Controlled" };

// #region demo
const SECTIONS = [
  { id: "overview", title: "Overview", level: 1 },
  { id: "install", title: "Installation", level: 1 },
  { id: "config", title: "Configuration", level: 2 },
  { id: "themes", title: "Themes", level: 2 },
  { id: "usage", title: "Usage", level: 1 },
  { id: "faq", title: "FAQ", level: 1 },
];

export function Controlled() {
  const active = signal("overview");
  const open = signal(false);
  return (
    <div class="flex items-start gap-6">
      <Button id="toc-open" size="sm" variant="secondary" onPress={() => open.set(!open())}>
        {open() ? "Close" : "Open"} list
      </Button>
      <FloatingToc open={open} triggerMode="press">
        <FloatingToc.Trigger id="toc-ctrl">
          {SECTIONS.map((s) => (
            <FloatingToc.Bar level={s.level} active={active() === s.id} />
          ))}
        </FloatingToc.Trigger>
        <FloatingToc.Content aria-label="On this page">
          {SECTIONS.map((s) => (
            <FloatingToc.Item id={`toc-ctrl-${s.id}`} level={s.level} active={active() === s.id} onPress={() => active.set(s.id)}>
              {s.title}
            </FloatingToc.Item>
          ))}
        </FloatingToc.Content>
      </FloatingToc>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Controlled />
    </div>
  );
}
