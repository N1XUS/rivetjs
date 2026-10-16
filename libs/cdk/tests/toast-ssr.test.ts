// Rivet: server render of the Toast family (RAC renders nothing for a ToastRegion during SSR; a resumed page
// adds the region with the first toast). Not an upstream port.
import { describe, expect, it } from "vitest";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { UNSTABLE_ToastQueue as ToastQueue, UNSTABLE_ToastRegion as ToastRegion, UNSTABLE_Toast as Toast, UNSTABLE_ToastContent as ToastContent } from "@rivetjs/cdk/toast";

const queue = new ToastQueue({ name: "ssr" });

export function App() {
  return (
    <div id="app">
      <ToastRegion queue={queue}>
        {({ toast }) => (
          <Toast toast={toast}>
            <ToastContent>{toast.content}</ToastContent>
          </Toast>
        )}
      </ToastRegion>
      <p>content</p>
    </div>
  );
}
`;

describe("Toast SSR", () => {
  it("renders no region on the server", async () => {
    const { App } = await importModule<{ App(): unknown }>("toast-ssr-fixture.tsx", source);
    const html = await renderHtml(() => App());
    expect(html).toContain("<p>content</p>");
    expect(html).not.toContain('role="region"');
    expect(html).not.toContain("rv-ToastRegion");
  });
});
