import { Link } from "@rivetjs/cdk/link";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Popover } from "@rivetjs/cdk/popover";
import { PreviewTrigger } from "@rivetjs/cdk/preview-trigger";

export const head = { title: "PreviewTrigger with plain CSS" };

// #region demo
export default function PlainCss() {
  return (
    <p class="text">
      See the{" "}
      <PreviewTrigger delay={0}>
        <Link id="ptcss-link" href="#">
          style guide
        </Link>
        <Popover id="ptcss-preview" offset={10}>
          <OverlayArrow>
            <span class="tip" />
          </OverlayArrow>
          <strong>Style guide</strong>
          <p>Colors, type and spacing for every product.</p>
        </Popover>
      </PreviewTrigger>{" "}
      before you start.
    </p>
  );
}
// #endregion
