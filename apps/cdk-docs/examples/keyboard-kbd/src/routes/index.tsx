import { Provider } from "@rivetjs/runtime/dom";
import { Keyboard, KeyboardContext } from "@rivetjs/cdk/keyboard";

export const head = { title: "Keyboard shortcuts" };

// #region demo
export default function KeyboardShortcuts() {
  return (
    <div class="demo">
      <p>
        Copy with <Keyboard id="kbd-copy">Ctrl+C</Keyboard>
      </p>
      <Provider token={KeyboardContext} value={{ class: "shortcut" }}>
        <ul>
          <li>
            Paste <Keyboard id="kbd-paste">Ctrl+V</Keyboard>
          </li>
          <li>
            Undo <Keyboard>Ctrl+Z</Keyboard>
          </li>
        </ul>
      </Provider>
    </div>
  );
}
// #endregion
