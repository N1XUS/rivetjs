import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ProgressBar } from "@rivetjs/cdk/progress-bar";

export const head = { title: "Pending Button" };

// #region demo
export default function SendMessage() {
  const pending = signal(false);
  const sent = signal(0);
  return (
    <form
      class="m-4 grid max-w-sm justify-items-start gap-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        sent.update((n) => n + 1);
        pending.set(true);
      }}
    >
      <Button id="send" type="submit" isPending={pending}>
        {({ isPending }) => (
          <>
            Send
            {/* The Button names its ProgressBar ("<id>-progress") and points aria-labelledby at it. */}
            {isPending() ? (
              <ProgressBar
                aria-label="Sending"
                isIndeterminate
                class="ml-2 inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            ) : null}
          </>
        )}
      </Button>
      {/* Stand-in for the server answering. */}
      <Button id="done" onPress={() => pending.set(false)}>
        Finish request
      </Button>
      <p id="status">
        Sent {sent()} time(s), {pending() ? "pending" : "idle"}
      </p>
    </form>
  );
}
// #endregion
