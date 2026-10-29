// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar/custom-image-component.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { ImageDescriptor } from "@rivetjs/runtime/image";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { Avatar } from "@rivetjs/ui/avatar";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";

export const head = { title: "Avatar: Custom Image Component" };

// #region demo
/**
 * A custom image component (upstream: Next.js `<Image>`): a responsive `srcSet` from the build's `?image` variants of the
 * file's own format, lazy loading and async decoding.
 */
function OptimizedImage(props: JSX.IntrinsicElements["img"] & { image: ImageDescriptor }) {
  const source = props.image.sources.at(-1)!;
  const { image: _image, ...rest } = props;
  return <img {...rest} decoding="async" loading="lazy" sizes={`${props.width ?? props.image.width}px`} srcSet={source.srcset} />;
}

export function CustomImageComponent() {
  return (
    <Avatar>
      <Avatar.Image alt="John Doe" height={40} render={(props) => <OptimizedImage {...props} image={avatarBlueImage} />} src={avatarBlueImage.src} width={40} />
      <Avatar.Fallback>JD</Avatar.Fallback>
    </Avatar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomImageComponent />
    </div>
  );
}
