import { Button } from "@rivetjs/cdk/button";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";

export const head = { title: "Tooltip with plain CSS" };

// #region demo
export default function PlainCss() {
  return (
    <section style={{ margin: "3rem 1rem" }}>
      <TooltipTrigger>
        <Button>Hover or focus me</Button>
        {/* A style zIndex replaces the positioning's 100000. */}
        <Tooltip id="tcss" style={{ zIndex: 50 }}>
          <OverlayArrow>
            <span class="tip" />
          </OverlayArrow>
          Styled by a stylesheet
        </Tooltip>
      </TooltipTrigger>
      <Button>Next</Button>
    </section>
  );
}
// #endregion
