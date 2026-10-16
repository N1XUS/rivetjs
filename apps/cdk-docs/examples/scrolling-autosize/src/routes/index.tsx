import { createVirtualScroll, CdkVirtualScrollViewport, CdkVirtualForOf } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll: autosize" };

const messages = Array.from({ length: 500 }, (_, i) => ({
  id: `m${i}`,
  text: `Message ${i}: ` + "lorem ipsum dolor sit amet ".repeat(1 + (i % 4)),
}));

// #region demo
export default function Messages() {
  const state = createVirtualScroll({ id: "messages", items: messages, autosize: true, minBufferPx: 100, maxBufferPx: 300, initialViewportSize: 240 });
  return (
    <section class="stack">
      <button id="messages-jump" type="button" onClick={() => (document.getElementById("messages")!.scrollTop = 3000)}>
        Scroll to 3000px
      </button>
      <button id="messages-top" type="button" onClick={() => (document.getElementById("messages")!.scrollTop = 0)}>
        Back to top
      </button>
      <CdkVirtualScrollViewport state={state} class="viewport" label="Messages">
        <ul role="list">
          <CdkVirtualForOf state={state} trackBy={(_, message) => message.id}>
            {(message) => (
              <li class="message" data-id={message().id}>
                {message().text}
              </li>
            )}
          </CdkVirtualForOf>
        </ul>
      </CdkVirtualScrollViewport>
    </section>
  );
}
// #endregion
