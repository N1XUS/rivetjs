import type { PageProps, RequestEvent } from "@rivetjs/router";
import { frameEntries, frameHead, FramePageView, loadFrame } from "@rivetjs/docs-kit/components/frame.tsx";
import { entries, load } from "@rivetjs/router";

// An example's other pages (`/examples/<id>/frame/<path>/`), linked relatively from its `/` page (`components/frame.tsx`).
export const paths = entries(() => frameEntries(true));

export const loader = load(async (event: RequestEvent<{ id: string; path: string }>) => {
  return loadFrame(event);
});

export const head = (input: { params: { id: string; path: string }; data: unknown }) => frameHead(input);

export default function ExampleFramePage(props: PageProps<"examples/[id]/frame/[...path]">) {
  return <FramePageView {...props} />;
}
