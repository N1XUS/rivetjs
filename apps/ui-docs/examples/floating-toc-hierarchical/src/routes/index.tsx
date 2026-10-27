// Rivet-authored FloatingToc demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { FloatingToc } from "@rivetjs/ui/floating-toc";

export const head = { title: "FloatingToc: Hierarchical" };

// #region demo
const SECTIONS = [
  { id: "overview", title: "Overview", level: 1 },
  { id: "install", title: "Installation", level: 1 },
  { id: "config", title: "Configuration", level: 2 },
  { id: "themes", title: "Themes", level: 2 },
  { id: "usage", title: "Usage", level: 1 },
  { id: "faq", title: "FAQ", level: 1 },
];

export function Hierarchical() {
  const active = signal("overview");
  return (
    <FloatingToc>
      <FloatingToc.Trigger id="toc-levels">
        {SECTIONS.map((s) => (
          <FloatingToc.Bar level={s.level} active={active() === s.id} />
        ))}
      </FloatingToc.Trigger>
      <FloatingToc.Content aria-label="On this page">
        {SECTIONS.map((s) => (
          <FloatingToc.Item id={`toc-levels-${s.id}`} level={s.level} active={active() === s.id} onPress={() => active.set(s.id)}>
            {s.title}
          </FloatingToc.Item>
        ))}
      </FloatingToc.Content>
    </FloatingToc>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Hierarchical />
    </div>
  );
}
