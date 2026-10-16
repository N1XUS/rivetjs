import { DialogTrigger } from "@rivetjs/cdk/dialog";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Pressable } from "@rivetjs/cdk/interactions/pressable";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Popover with a custom trigger" };

// #region demo
export default function CustomTrigger() {
  return (
    <section class="m-4 text-sm">
      <DialogTrigger>
        {/* Any pressable element: Pressable passes the press, focus and trigger props to its child. */}
        <Pressable>
          {(props) => (
            <span {...props} id="ct-trigger" role="button" class="cursor-pointer underline decoration-dotted">
              Custom trigger
            </span>
          )}
        </Pressable>
        <Popover>
          <Dialog id="ct" aria-label="Custom trigger">
            This popover was triggered by a custom button.
          </Dialog>
        </Popover>
      </DialogTrigger>
    </section>
  );
}
// #endregion
