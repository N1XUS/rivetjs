import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { StreamingText } from "@rivetjs/ui/streaming-text";
import { Markdown } from "@rivetjs/ui/markdown";

export default function StreamingTextStory() {
  const text = signal("");
  const running = signal(false);
  return (
    <main class="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <Button
        id="burst"
        onPress={() => {
          running.set(true);
          text.set("Hello world");
        }}
      >
        Receive a burst
      </Button>
      <Button id="finish" onPress={() => running.set(false)}>
        Finish input
      </Button>
      <Button
        id="reset"
        onPress={() => {
          text.set("");
          running.set(false);
        }}
      >
        Reset
      </Button>
      <StreamingText id="plain" content={text} isStreaming={running} speed={20} />
      <Markdown id="formatted" content={text} isStreaming={running} streamingSpeed={20} />
      <Markdown id="scalar" content={text()} isStreaming={running()} streamingSpeed={20} />
      <p id="following">The following element stays in the document flow.</p>
      <StreamingText id="initial" content="Existing 👩🏽‍💻 text" />
    </main>
  );
}
