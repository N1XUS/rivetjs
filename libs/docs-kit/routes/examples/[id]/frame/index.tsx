import type { PageProps, RequestEvent } from "@rivetjs/router";
import { frameEntries, frameHead, FramePageView, loadFrame } from "@rivetjs/docs-kit/components/frame.tsx";
import { entries, load } from "@rivetjs/router";

// An example's page `/` inside the docs app, without the docs chrome (`components/frame.tsx`).
export const paths = entries(() => frameEntries(false));

export const loader = load(async (event: RequestEvent<{ id: string }>) => {
  return loadFrame(event);
});

export const head = (input: { params: { id: string }; data: unknown }) => frameHead(input);

export default function ExampleFrame(props: PageProps<"examples/[id]/frame">) {
  return <FramePageView {...props} />;
}
