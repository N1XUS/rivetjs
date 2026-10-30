// Server-only native hooks disappear entirely from browser builds, preserving ordinary Kit head bytes.
export const prepareNativeHead = undefined;
export const renderNativeHead = undefined;
// Keep the imports-map value export surface equal to the server helper; neither server-only hook is imported by DOM code.
export const copyHeadRendering = undefined;
export const lateHeadTags = undefined;
