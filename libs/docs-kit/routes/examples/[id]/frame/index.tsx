import type { PageProps, RequestEvent } from "@rivetjs/router";
import { frameEntries, frameHead, FramePageView, loadFrame } from "@rivetjs/docs-kit/components/frame.tsx";

// An example's page `/` inside the docs app, without the docs chrome (`components/frame.tsx`).
export const serverEntries = () => frameEntries(false);

export async function serverLoad(event: RequestEvent<{ id: string }>) {
  return loadFrame(event);
}

export const head = (input: { params: { id: string }; data: unknown }) => frameHead(input);

export default function ExampleFrame(props: PageProps<"examples/[id]/frame">) {
  return <FramePageView {...props} />;
}
