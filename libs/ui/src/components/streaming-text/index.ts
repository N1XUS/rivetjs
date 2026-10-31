import { StreamingTextRoot } from "./streaming-text.tsx";
import type { StreamingTextProps } from "./streaming-text.tsx";

export const StreamingText = Object.assign(StreamingTextRoot, { Root: StreamingTextRoot });
export type StreamingText = { Props: StreamingTextProps; RootProps: StreamingTextProps };
export { StreamingTextRoot };
export type { StreamingTextProps, StreamingTextProps as StreamingTextRootProps };
export { streamingTextVariants } from "../../../styles/src/components/streaming-text/index.ts";
export type { StreamingTextVariants } from "../../../styles/src/components/streaming-text/index.ts";
