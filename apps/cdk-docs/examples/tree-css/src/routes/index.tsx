import { ChevronRight } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree: plain CSS" };

// #region demo
function Row(props: { label: string }) {
  return (
    <TreeItemContent>
      {({ hasChildItems }) => (
        <div class="row">
          {hasChildItems() ? (
            <Button slot="chevron">
              <Icon icon={ChevronRight} size={14} />
            </Button>
          ) : (
            <span class="spacer" />
          )}
          {props.label}
        </div>
      )}
    </TreeItemContent>
  );
}

export default function Mail() {
  return (
    <Tree id="css-tree" aria-label="Mailboxes" selectionMode="single" defaultExpandedKeys={["inbox"]}>
      <TreeItem id="inbox" textValue="Inbox">
        <Row label="Inbox" />
        <TreeItem id="work" textValue="Work">
          <Row label="Work" />
        </TreeItem>
        <TreeItem id="family" textValue="Family">
          <Row label="Family" />
        </TreeItem>
      </TreeItem>
      <TreeItem id="sent" textValue="Sent">
        <Row label="Sent" />
      </TreeItem>
      <TreeItem id="archive" textValue="Archive" isDisabled>
        <Row label="Archive" />
      </TreeItem>
    </Tree>
  );
}
// #endregion
