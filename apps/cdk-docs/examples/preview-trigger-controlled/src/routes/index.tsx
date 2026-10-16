import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Link } from "@rivetjs/cdk/link";
import { Popover } from "@rivetjs/cdk/popover";
import { PreviewTrigger } from "@rivetjs/cdk/preview-trigger";

export const head = { title: "Controlled PreviewTrigger" };

// #region demo
export default function Controlled() {
  const open = signal(false);
  const log = signal<string[]>([]);
  return (
    <section class="mx-4 mt-8 grid justify-items-start gap-3 text-sm">
      <div class="flex items-center gap-2">
        <Button id="ptk-show" class="rv-Button" onPress={() => open.set(true)}>
          Show preview
        </Button>
        <Button id="ptk-hide" class="rv-Button" onPress={() => open.set(false)}>
          Hide preview
        </Button>
      </div>
      <p class="m-0">
        Read the{" "}
        <PreviewTrigger isOpen={open} onOpenChange={(isOpen) => log.update((l) => [...l, isOpen ? "open" : "close"])}>
          <Link id="ptk-link" href="#" class="text-indigo-700">
            release notes
          </Link>
          <Popover id="ptk-preview" class="rv-Popover p-3" placement="bottom start">
            Version 2.0: PreviewTrigger, safe areas and faster tooltips.
          </Popover>
        </PreviewTrigger>
        .
      </p>
      <p id="ptk-state" class="m-0">
        open={String(open())}
      </p>
      <output id="ptk-log" class="font-mono text-xs">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
