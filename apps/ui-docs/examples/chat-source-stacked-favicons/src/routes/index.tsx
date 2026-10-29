// Rivet-authored ChatSource demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ChatSource, ChatSources } from "@rivetjs/ui/chat-source";

export const head = { title: "ChatSource: Stacked Favicons" };

// #region demo
const SOURCES = [
  { href: "https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API", title: "View Transition API" },
  { href: "https://web.dev/articles/view-transitions", title: "Smooth transitions" },
  { href: "https://www.w3.org/TR/css-view-transitions-1/", title: "CSS View Transitions" },
  { href: "https://caniuse.com/view-transitions", title: "Browser support" },
];

export function StackedFavicons() {
  return (
    <ChatSources class="w-96">
      <ChatSources.Trigger>
        <ChatSources.Favicons sources={SOURCES} />
        {SOURCES.length} sources
      </ChatSources.Trigger>
      <ChatSources.Content>
        <ChatSources.List>
          {SOURCES.map((source) => (
            <ChatSource href={source.href} title={source.title} />
          ))}
        </ChatSources.List>
      </ChatSources.Content>
    </ChatSources>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StackedFavicons />
    </div>
  );
}
