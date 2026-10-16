// Rivet-authored Segment demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Segment } from "@rivetjs/ui/segment";
import { Bell, Inbox, Star } from "lucide";

export const head = { title: "Segment: Icon Expand" };

// #region demo
export function IconExpand() {
  return (
    <Segment aria-label="Mailbox" defaultSelectedKey="inbox">
      <Segment.Item aria-label="Inbox" id="inbox">
        {({ isSelected }) => (
          <>
            <Icon icon={Inbox} />
            {isSelected() ? "Inbox" : null}
          </>
        )}
      </Segment.Item>
      <Segment.Item aria-label="Starred" id="starred">
        {({ isSelected }) => (
          <>
            <Icon icon={Star} />
            {isSelected() ? "Starred" : null}
          </>
        )}
      </Segment.Item>
      <Segment.Item aria-label="Alerts" id="alerts">
        {({ isSelected }) => (
          <>
            <Icon icon={Bell} />
            {isSelected() ? "Alerts" : null}
          </>
        )}
      </Segment.Item>
    </Segment>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <IconExpand />
    </div>
  );
}
