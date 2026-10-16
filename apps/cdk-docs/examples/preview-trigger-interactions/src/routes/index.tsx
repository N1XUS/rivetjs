import { Button } from "@rivetjs/cdk/button";
import { Link } from "@rivetjs/cdk/link";
import { Popover } from "@rivetjs/cdk/popover";
import { PreviewTrigger } from "@rivetjs/cdk/preview-trigger";

export const head = { title: "PreviewTrigger interactions" };

// #region demo
function IssuePreview(props: { number: number; title: string; status: string; author: string; delay?: number; closeDelay?: number; isDisabled?: boolean }) {
  const { number, title, status, author } = props;
  return (
    <PreviewTrigger delay={props.delay} closeDelay={props.closeDelay} isDisabled={props.isDisabled}>
      <Link id={`issue-${number}`} href="#" class="font-medium text-indigo-700">
        #{number}
      </Link>
      <Popover id={`issue-${number}-preview`} class="rv-Popover w-70 p-3 text-sm">
        {() => (
          <>
            <div class="font-semibold">{title}</div>
            <div class="mt-1 text-xs text-slate-500">
              #{number} · {status}
            </div>
            <div class="mt-1 text-xs text-slate-500">Opened by {author}</div>
            <Button id={`issue-${number}-view`} class="rv-Button mt-3">
              View issue
            </Button>
          </>
        )}
      </Popover>
    </PreviewTrigger>
  );
}

export default function Changelog() {
  return (
    <p class="mx-4 mt-8 max-w-120 text-sm">
      Merged fixes for <IssuePreview number={1234} title="Add PreviewTrigger component" status="Open" author="mayachen" delay={0} closeDelay={0} /> and{" "}
      <IssuePreview number={5678} title="Improve Popover safe area behavior" status="Closed" author="cwebb" />. Archived:{" "}
      <IssuePreview number={9012} title="Legacy hover cards" status="Closed" author="mayachen" delay={0} isDisabled />.
    </p>
  );
}
// #endregion
