import { signal } from "@rivetjs/reactivity";
import { Toolbar } from "@rivetjs/cdk/toolbar";
import { Group } from "@rivetjs/cdk/group";

export const head = { title: "Toolbar with groups" };

// #region demo
export default function Groups() {
  const log = signal<string[]>([]);
  return (
    <section style={{ margin: "1rem", display: "grid", gap: "0.5rem", justifyItems: "start" }}>
      <button type="button" id="before">
        Before
      </button>
      <Toolbar id="tools" aria-label="Text" lang="en" onClick={() => log.update((l) => [...l, "toolbar-click"])}>
        {/* A toolbar inside a toolbar renders role="group"; the outer one handles the keys. */}
        <Toolbar id="align" aria-label="Align">
          <button type="button" id="align-left">
            Left
          </button>
          <button type="button" id="align-center">
            Center
          </button>
          <button type="button" id="align-right">
            Right
          </button>
        </Toolbar>
        <span role="separator" aria-orientation="vertical" />
        <Group aria-label="Zoom">
          <button type="button" id="zoom-in">
            Zoom in
          </button>
          <button type="button" id="zoom-out">
            Zoom out
          </button>
        </Group>
      </Toolbar>
      <button type="button" id="after">
        After
      </button>
      <p>
        Log: <output id="tb-log">{log().join(" ")}</output>
      </p>
    </section>
  );
}
// #endregion
