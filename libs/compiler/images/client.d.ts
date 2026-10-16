// Ambient image import types (`@rivetjs/compiler/images/client`): `?image`, `?jsx`, `?svg`. Add it to tsconfig "types".
// The keyword goes LAST (`./a.png?width=800&image`): an ambient module pattern has one wildcard, so
// `?image&width=800` cannot be typed (it still builds; the Vite plugin warns).
declare module "*?image" {
  const image: import("@rivetjs/runtime/image").ImageDescriptor;
  export default image;
}
declare module "*&image" {
  const image: import("@rivetjs/runtime/image").ImageDescriptor;
  export default image;
}
declare module "*?jsx" {
  const Image: (props: Omit<import("@rivetjs/runtime/image").PictureProps, "image">) => unknown;
  export default Image;
}
declare module "*&jsx" {
  const Image: (props: Omit<import("@rivetjs/runtime/image").PictureProps, "image">) => unknown;
  export default Image;
}
// Inline `?svg` component: any `<svg>` attribute (`class`, `style` object, `aria-*`, …) lands on the root;
// `size` = width + height (viewBox keeps the aspect); `title` renders <title> + role="img" (else aria-hidden="true"
// unless aria-label / aria-labelledby is set).
declare module "*?svg" {
  type Props = import("@rivetjs/runtime/jsx-runtime").JSX.IntrinsicElements["svg"] & { size?: number | string; title?: string };
  const Svg: (props?: Props) => import("@rivetjs/runtime/jsx-runtime").JSX.Element;
  export default Svg;
}
declare module "*&svg" {
  type Props = import("@rivetjs/runtime/jsx-runtime").JSX.IntrinsicElements["svg"] & { size?: number | string; title?: string };
  const Svg: (props?: Props) => import("@rivetjs/runtime/jsx-runtime").JSX.Element;
  export default Svg;
}
