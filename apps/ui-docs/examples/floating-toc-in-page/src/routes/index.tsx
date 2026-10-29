// Rivet-authored FloatingToc demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { FloatingToc } from "@rivetjs/ui/floating-toc";

export const head = { title: "FloatingToc: In Page Context" };

// #region demo
const SECTIONS = [
  { id: "overview", title: "Overview", level: 1 },
  { id: "install", title: "Installation", level: 1 },
  { id: "config", title: "Configuration", level: 2 },
  { id: "themes", title: "Themes", level: 2 },
  { id: "usage", title: "Usage", level: 1 },
  { id: "faq", title: "FAQ", level: 1 },
];

export function InPage() {
  const active = signal("overview");
  clientEffect(() => {
    const scroller = document.getElementById("toc-page");
    if (!scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) active.set(entry.target.id.replace("sec-", ""));
      },
      { root: scroller, rootMargin: "0px 0px -70% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(`sec-${s.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  });
  const go = (id: string) => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div class="relative w-full max-w-xl">
      <div id="toc-page" class="h-96 overflow-y-auto rounded-2xl bg-surface p-6 pe-16 shadow-surface">
        {SECTIONS.map((s) => (
          <section id={`sec-${s.id}`} class="mb-6 min-h-48">
            <h3 class="mb-2 text-base font-semibold">{s.title}</h3>
            <p class="text-sm text-muted">Section text for {s.title.toLowerCase()}. Scroll to see the active bar follow along.</p>
          </section>
        ))}
      </div>
      <div class="absolute end-2 top-4">
        <FloatingToc>
          <FloatingToc.Trigger id="toc-page-trigger">
            {SECTIONS.map((s) => (
              <FloatingToc.Bar level={s.level} active={active() === s.id} />
            ))}
          </FloatingToc.Trigger>
          <FloatingToc.Content aria-label="On this page">
            {SECTIONS.map((s) => (
              <FloatingToc.Item level={s.level} active={active() === s.id} onPress={() => go(s.id)}>
                {s.title}
              </FloatingToc.Item>
            ))}
          </FloatingToc.Content>
        </FloatingToc>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <InPage />
    </div>
  );
}
