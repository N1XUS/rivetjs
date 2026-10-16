import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";
import { css } from "@rivetjs/runtime/css";
import { HeadLink, Meta } from "@rivetjs/kit";

export const head = { titleTemplate: "%s | Kit" };

// Read by a resumed binding: the resume symbol must see the compiled class names too.
const styles = css`
  .clicked {
    outline: 2px solid rgb(7, 8, 9);
  }
`;

export default function Layout({ children }: LayoutProps) {
  const clicks = signal(0);
  return (
    <div>
      <Meta name="theme-color" content="#123456" />
      <HeadLink rel="icon" href="/icon.svg" type="image/svg+xml" />
      <nav>
        <a href="/">Home</a> <a href="/about">About</a>
      </nav>
      <button type="button" class={clicks() > 0 ? styles.clicked : ""} onClick={() => clicks.update((n) => n + 1)}>
        Clicks {clicks()}
      </button>
      <main>{children}</main>
    </div>
  );
}
