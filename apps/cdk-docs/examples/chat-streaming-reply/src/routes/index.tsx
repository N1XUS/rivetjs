import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { isSubmitKey, simulateStream, streamText } from "@rivetjs/cdk/chat";

export const head = { title: "Streaming reply" };

// #region demo
export default function StreamingReply() {
  const draft = signal("");
  const question = signal("");
  const reply = signal("");
  const pending = signal(false);

  const send = async () => {
    const text = draft().trim();
    if (!text || pending()) return;
    question.set(text);
    draft.set("");
    reply.set("");
    pending.set(true);
    try {
      await streamText(reply, simulateStream(`You asked: "${text}". Your report is ready.`, { interval: 20 }));
    } finally {
      pending.set(false);
    }
  };

  return (
    <div class="demo">
      <div class="log">
        <p id="chat-question">{question() || "No message yet"}</p>
        <p id="chat-reply">{reply()}</p>
      </div>
      <form
        class="composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          id="chat-input"
          aria-label="Message"
          rows={2}
          value={draft()}
          onInput={(event) => draft.set((event.target as HTMLTextAreaElement).value)}
          onKeyDown={(event) => {
            if (isSubmitKey(event)) {
              event.preventDefault();
              send();
            }
          }}
        />
        <Button id="chat-send" type="submit" isPending={pending}>
          Send
        </Button>
      </form>
    </div>
  );
}
// #endregion
