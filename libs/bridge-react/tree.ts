// The element tree an island renders, identical on both sides (React `useId` paths agree): a head mark, then the
// component. The server's mark renders a sentinel element: React writes its hoistables (`<title>`, `<meta>`,
// `<link>`, `<style>`) before the first content, so everything before the sentinel is the island's head; the client's
// mark renders nothing (the sentinel is cut from the HTML), so hydration sees the same DOM.
import { Fragment, createElement, type ComponentType, type ReactElement } from "react";

/** The island element: `[mark, component(props)]`. */
export const islandElement = (mark: ComponentType, component: ComponentType<Record<string, unknown>>, props: Record<string, unknown>): ReactElement =>
  createElement(Fragment, null, createElement(mark, { key: "h" }), createElement(component, { ...props, key: "c" }));
