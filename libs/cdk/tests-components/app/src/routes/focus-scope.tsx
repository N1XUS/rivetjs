import { FocusScope } from "@rivetjs/cdk/focus-scope";

export const head = { title: "FocusScope" };

export default function FocusScopeStory() {
  return (
    <section>
      <h1>FocusScope</h1>
      <button id="before" type="button">
        Before
      </button>
      <FocusScope contain>
        <input id="scope-title" aria-label="Title" />
        <button id="scope-save" type="button">
          Save
        </button>
        <button id="scope-cancel" type="button">
          Cancel
        </button>
      </FocusScope>
      <button id="after" type="button">
        After
      </button>
    </section>
  );
}
