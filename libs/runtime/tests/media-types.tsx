// Type tests for media element attributes (checked by media-types.test.ts with strict tsc).
export const video = <video src="/a.mp4" width={640} height="360" controls muted playsInline poster="/a.jpg" />;
export const audio = <audio src="/a.mp3" controls />;
// @ts-expect-error <audio> has no width
export const audioWidth = <audio src="/a.mp3" width={10} />;
