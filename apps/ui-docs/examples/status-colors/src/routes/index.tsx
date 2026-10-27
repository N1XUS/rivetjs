// Rivet-authored Status demo (Rivet addition, own demo content).
import { Status } from "@rivetjs/ui/status";

export const head = { title: "Status: Colors" };

// #region demo
export function Colors() {
  return (
    <ul id="status-colors" class="flex flex-wrap items-center gap-6 text-sm">
      <li class="flex items-center gap-2">
        <Status /> Default
      </li>
      <li class="flex items-center gap-2">
        <Status color="accent" /> Accent
      </li>
      <li class="flex items-center gap-2">
        <Status color="success" /> Success
      </li>
      <li class="flex items-center gap-2">
        <Status color="warning" /> Warning
      </li>
      <li class="flex items-center gap-2">
        <Status color="danger" /> Danger
      </li>
    </ul>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Colors />
    </div>
  );
}
