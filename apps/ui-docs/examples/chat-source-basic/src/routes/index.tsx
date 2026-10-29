// Rivet-authored ChatSource demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ChatSource } from "@rivetjs/ui/chat-source";

export const head = { title: "ChatSource: Usage" };

// #region demo
export function Basic() {
  return (
    <p class="max-w-md text-sm leading-7">
      Popovers can now be built without JavaScript{" "}
      <ChatSource
        href="https://developer.mozilla.org/en-US/docs/Web/API/Popover_API"
        title="Popover API"
        description="The Popover API gives developers a standard mechanism for displaying popover content on top of other page content."
      />{" "}
      and anchored with CSS <ChatSource href="https://www.w3.org/TR/css-anchor-position-1/" />.
    </p>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
