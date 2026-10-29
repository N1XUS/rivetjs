// Rivet-authored PressableFeedback demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";
import { Bell, ChevronRight, Lock, UserRound } from "lucide";

export const head = { title: "PressableFeedback: With Highlight" };

// #region demo
export function WithHighlight() {
  const opened = signal("None");
  const rows = [
    { id: "pf-row-account", title: "Account", text: "Name, email, photo", icon: UserRound },
    { id: "pf-row-notifications", title: "Notifications", text: "Email and push", icon: Bell },
    { id: "pf-row-privacy", title: "Privacy", text: "Sessions and data", icon: Lock },
  ];
  return (
    <div class="flex w-80 flex-col gap-3">
      <div class="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-surface">
        {rows.map((row) => (
          <PressableFeedback id={row.id} class="flex w-full items-center gap-3 px-4 py-3 text-start" onPress={() => opened.set(row.title)}>
            <PressableFeedback.Highlight />
            <Icon icon={row.icon} size={18} class="text-muted" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-sm font-medium">{row.title}</span>
              <span class="text-xs text-muted">{row.text}</span>
            </span>
            <Icon icon={ChevronRight} size={16} class="text-muted" />
          </PressableFeedback>
        ))}
      </div>
      <p id="pf-with-highlight-status" class="text-sm text-muted">
        Opened: {opened()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithHighlight />
    </div>
  );
}
