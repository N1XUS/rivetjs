import { signal } from "@rivetjs/reactivity";
import { FloatingToc } from "@rivetjs/ui/floating-toc";

export const head = { title: "FloatingToc" };

const SECTIONS = [
  { id: "intro", title: "Introduction", level: 1 },
  { id: "install", title: "Installation", level: 1 },
  { id: "config", title: "Configuration", level: 2 },
  { id: "usage", title: "Usage", level: 1 },
];

// Rivet addition (feature set inspired by HeroUI Pro's public Floating TOC docs): a hover TOC and a press TOC over a fixed
// section list; an item press sets the active section. Resumes on the first hover / press.
export default function FloatingTocStory() {
  const active = signal("intro");
  const list = (prefix: string) =>
    SECTIONS.map((s) => (
      <FloatingToc.Item id={`${prefix}-${s.id}`} level={s.level} active={active() === s.id} onPress={() => active.set(s.id)}>
        {s.title}
      </FloatingToc.Item>
    ));
  return (
    <main class="flex max-w-xl items-start gap-16 bg-background p-10 text-foreground">
      <FloatingToc>
        <FloatingToc.Trigger id="toc-hover">
          {SECTIONS.map((s) => (
            <FloatingToc.Bar level={s.level} active={active() === s.id} />
          ))}
        </FloatingToc.Trigger>
        <FloatingToc.Content id="toc-hover-content" aria-label="Sections">
          {list("h")}
        </FloatingToc.Content>
      </FloatingToc>
      <FloatingToc triggerMode="press" placement="left">
        <FloatingToc.Trigger id="toc-press">
          {SECTIONS.map((s) => (
            <FloatingToc.Bar level={s.level} active={active() === s.id} />
          ))}
        </FloatingToc.Trigger>
        <FloatingToc.Content id="toc-press-content" aria-label="Sections">
          {list("p")}
        </FloatingToc.Content>
      </FloatingToc>
      <p id="toc-active">{active()}</p>
    </main>
  );
}
