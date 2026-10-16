import { $, component$, sync$, type QRL } from '@builder.io/qwik';

const plainClick = sync$((e: MouseEvent) => {
  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) e.preventDefault();
});

/** Detail view: its own component$ boundary, so its render code is a lazily loaded segment. */
export const Detail = component$<{ label: string; navigate: QRL<(href: string) => void> }>(
  ({ label, navigate }) => {
    return (
      <article id="detail">
        <h2>{label}</h2>
        <a
          id="back"
          href="/"
          onClick$={[
            plainClick,
            $((e: MouseEvent) => {
              if (e.defaultPrevented) navigate('/');
            }),
          ]}
        >
          back
        </a>
      </article>
    );
  }
);
