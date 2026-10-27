// Rivet-authored ListView demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ListView } from "@rivetjs/ui/list-view";
import { FileText, Image, Sheet } from "lucide";

export const head = { title: "ListView: Usage" };

// #region demo
const FILES = [
  { id: "report", name: "Q3 report.pdf", meta: "1.2 MB · Edited today", icon: FileText },
  { id: "budget", name: "Budget 2027.xlsx", meta: "380 KB · Edited yesterday", icon: Sheet },
  { id: "photo", name: "Team photo.jpg", meta: "4.8 MB · Edited last week", icon: Image },
];

export function Basic() {
  const opened = signal("Press a file");
  return (
    <div id="lv-basic" class="w-full max-w-md flex flex-col gap-3">
      <ListView aria-label="Files" onAction={(key) => opened.set(`Opened ${String(key)}`)}>
        {FILES.map((f) => (
          <ListView.Item id={f.id} textValue={f.name}>
            <ListView.ItemContent>
              <Icon icon={f.icon} size={20} class="text-muted" />
              <div>
                <ListView.Title>{f.name}</ListView.Title>
                <ListView.Description>{f.meta}</ListView.Description>
              </div>
            </ListView.ItemContent>
          </ListView.Item>
        ))}
      </ListView>
      <p id="lv-basic-status" class="text-sm text-muted">
        {opened}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
