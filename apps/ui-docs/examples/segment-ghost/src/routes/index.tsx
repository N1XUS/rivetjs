// Rivet-authored Segment demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Segment } from "@rivetjs/ui/segment";

export const head = { title: "Segment: Ghost" };

// #region demo
export function Ghost() {
  return (
    <Segment aria-label="Feed" defaultSelectedKey="following" variant="ghost">
      <Segment.Item id="for-you">For you</Segment.Item>
      <Segment.Item id="following">Following</Segment.Item>
      <Segment.Item id="trending">Trending</Segment.Item>
    </Segment>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Ghost />
    </div>
  );
}
