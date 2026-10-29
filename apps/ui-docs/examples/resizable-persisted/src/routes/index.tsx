// Rivet-authored Resizable demo (cookie-persisted layout rendered by the server;
// independent implementation on `useDefaultLayout` + `cookieStorage`).
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { load } from "@rivetjs/router";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, cookieStorage, useDefaultLayout } from "@rivetjs/ui/resizable";

export const head = { title: "Resizable: Persisted layout" };

// #region demo
// The server reads the request's cookies, so the first paint already has the saved sizes: no layout shift,
// no restore in the browser.
export const loader = load(({ request }: RequestEvent) => ({ cookie: request.headers.get("cookie") ?? "" }));

export default function PersistedLayout({ data }: PageProps<{ cookie: string }, {}>) {
  // Saved under the cookie `react-resizable-panels:app-shell` after each change (the key the upstream library uses).
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "app-shell", storage: cookieStorage(data.cookie) });
  return (
    <main class="flex min-h-dvh items-center justify-center p-6">
      <ResizablePanelGroup
        id="app-shell"
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        class="min-h-[240px] w-full max-w-2xl rounded-xl border border-separator"
      >
        <ResizablePanel id="sidebar" defaultSize="30%" minSize="20%" class="bg-surface">
          <div class="p-4 text-sm font-medium">Sidebar</div>
        </ResizablePanel>
        <ResizableHandle id="shell-handle" withIndicator aria-label="Resize sidebar" />
        <ResizablePanel id="main" defaultSize="70%">
          <div class="flex h-full items-center justify-center p-4 text-sm text-muted">Resize, then reload: the layout comes back from the cookie.</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
// #endregion
