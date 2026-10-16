// `import inter from "./inter.woff2?font"` / `"google-font:Inter?weight=400&font"` (kit() Vite plugin): add "@rivetjs/kit/client" to `types`.
declare module "*?font" {
  const font: import("@rivetjs/kit/font").FontDescriptor;
  export default font;
}
declare module "*&font" {
  const font: import("@rivetjs/kit/font").FontDescriptor;
  export default font;
}
