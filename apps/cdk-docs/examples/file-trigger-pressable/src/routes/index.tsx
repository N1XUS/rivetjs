import { FileTrigger } from "@rivetjs/cdk/file-trigger";
import { Link } from "@rivetjs/cdk/link";
import { Pressable } from "@rivetjs/cdk/interactions/pressable";

export const head = { title: "FileTrigger with a Link or a custom pressable" };

// #region demo
export default function CustomTriggers() {
  return (
    <div class="m-4 flex items-center gap-4 text-sm">
      <FileTrigger data-testid="via-link">
        <Link id="attach" class="cursor-pointer text-indigo-700 underline">
          Attach a file
        </Link>
      </FileTrigger>
      <FileTrigger data-testid="via-pressable">
        <Pressable>
          {(props) => (
            <span {...props} id="drop-target" role="button" tabIndex={0} class="rounded border border-dashed px-3 py-2">
              Choose…
            </span>
          )}
        </Pressable>
      </FileTrigger>
    </div>
  );
}
// #endregion
