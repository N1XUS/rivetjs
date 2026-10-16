import { Group, Panel, Separator } from "@rivetjs/cdk/resizable";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "Resizable: conditional panels" };

// #region demo
export default function ResizableConditional() {
  const showPreview = signal(true);
  return (
    <div>
      <div class="Toolbar">
        <button id="toggle-preview" type="button" onClick={() => showPreview.set(!showPreview())}>
          {showPreview() ? "Hide preview" : "Show preview"}
        </button>
      </div>
      <Group id="cond" class="Group">
        <Panel id="source" defaultSize="50%" minSize="20%">
          <div class="Panel">Source</div>
        </Panel>
        {() =>
          showPreview() ? (
            <>
              <Separator id="cond-sep" class="Handle" />
              <Panel id="preview" minSize="20%">
                <div class="Panel">Preview</div>
              </Panel>
            </>
          ) : null
        }
      </Group>
    </div>
  );
}
// #endregion
