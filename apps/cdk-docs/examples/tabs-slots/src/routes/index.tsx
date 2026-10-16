import { signal } from "@rivetjs/reactivity";
import { Tabs, type Key } from "@rivetjs/cdk/tabs";
import { ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tabs from items" };

const folders = [
  { id: "inbox", label: "Inbox", count: 12 },
  { id: "drafts", label: "Drafts", count: 2 },
  { id: "sent", label: "Sent", count: 0 },
];

// #region demo
export default function Mail() {
  const folder = signal<Key | null>("inbox");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      {/* The items preset: one Tabs with data, the same TabList / Tab / TabPanels / TabPanel parts inside. */}
      <Tabs
        id="mail"
        aria-label="Folders"
        items={folders}
        selectedKey={folder}
        // Tab slot: any content. Read the signal for selection-dependent content.
        tab={(item) => (
          <span class="inline-flex items-center gap-1">
            {folder() === item.id ? <Icon icon={ChevronRight} size={14} /> : ""}
            {item.label}
            <span class="rounded-full bg-slate-200 px-1.5 text-xs" id={"count-" + item.id}>
              {String(folders.find((f) => f.id === item.id)?.count ?? 0)}
            </span>
          </span>
        )}
        // Panel slot: every panel is rendered (inactive ones hidden + inert); a panel with a tabbable element is no tab stop itself.
        panel={(item) =>
          item.id === "sent" ? (
            <p>Nothing sent yet.</p>
          ) : (
            <p>
              {item.label}:{" "}
              <button type="button" id={"open-" + item.id} class="rounded border px-2">
                Open first message
              </button>
            </p>
          )
        }
      />
    </section>
  );
}
// #endregion
