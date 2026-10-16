import type { PageProps, RequestEvent } from "@rivetjs/router";
import { frameEntries, frameHead, FramePageView, loadFrame } from "@rivetjs/docs-kit/components/frame.tsx";

// An example's other pages (`/examples/<id>/frame/<path>/`), linked relatively from its `/` page (`components/frame.tsx`).
export const serverEntries = () => frameEntries(true);

export async function serverLoad(event: RequestEvent<{ id: string; path: string }>) {
  return loadFrame(event);
}

export const head = (input: { params: { id: string; path: string }; data: unknown }) => frameHead(input);

export default function ExampleFramePage(props: PageProps<"examples/[id]/frame/[...path]">) {
  return <FramePageView {...props} />;
}
