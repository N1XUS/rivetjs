import { signal } from "@rivetjs/reactivity";
import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Link press events" };

// #region demo
export default function LinkEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <p>
        Read the{" "}
        <Link
          id="more"
          onPress={(event) => add("press:" + event.pointerType)}
          onPressStart={(event) => add("start:" + event.pointerType)}
          onPressEnd={(event) => add("end:" + event.pointerType)}
          onPressUp={(event) => add("up:" + event.pointerType)}
          onPressChange={(isPressed) => add("pressed:" + isPressed)}
          onFocusChange={(isFocused) => add("focus:" + isFocused)}
          onKeyDown={(event) => add("keydown:" + event.key)}
        >
          release notes
        </Link>
        .
      </p>
      <output id="link-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
