import { PreviewTrigger } from "@rivetjs/cdk/preview-trigger";
import { Popover } from "@rivetjs/cdk/popover";
import { Link } from "@rivetjs/cdk/link";

export const head = { title: "PreviewTrigger" };

// Stories for react-aria-components test/PreviewTrigger.test.js: a link previewing its destination in a
// non-modal popover on hover (600 ms warmup), keyboard focus or touch long press.
export default function PreviewTriggerStory() {
  return (
    <section>
      <h1>PreviewTrigger</h1>
      <div style={{ marginBlockStart: "120px", marginInlineStart: "120px" }}>
        Read the{" "}
        <PreviewTrigger>
          <Link id="docs-link" href="#docs">
            docs
          </Link>
          <Popover id="docs-preview" placement="bottom">
            <p>Documentation preview.</p>
            <a id="preview-inside" href="#inside">
              Open
            </a>
          </Popover>
        </PreviewTrigger>{" "}
        or the{" "}
        <PreviewTrigger delay={0} closeDelay={0}>
          <Link id="fast-link" href="#fast">
            guide
          </Link>
          <Popover id="fast-preview" offset={40}>
            <p>Guide preview.</p>
          </Popover>
        </PreviewTrigger>
        .
      </div>
      <button type="button" id="after">
        After
      </button>
      <PreviewTrigger isDisabled delay={0}>
        <Link id="disabled-link" href="#disabled">
          disabled
        </Link>
        <Popover id="disabled-preview">
          <p>Never shown.</p>
        </Popover>
      </PreviewTrigger>
    </section>
  );
}
