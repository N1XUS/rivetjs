// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no QR code): QR symbol on HeroUI tokens — module
// shapes (square / dots / rounded), colour presets (theme foreground, accent, logo-gradient brand, warm sunset), three
// sizes, a centred icon plate, a loading placeholder with a skeleton sweep and an optional decorative shimmer.
import "../../../out/qr-code.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const qrCodeVariants = tv({
  defaultVariants: {
    color: "default",
    shape: "square",
    size: "md",
  },
  slots: {
    base: "qr-code",
    body: "qr-code__body",
    eyes: "qr-code__eyes",
    icon: "qr-code__icon",
    svg: "qr-code__svg",
  },
  variants: {
    color: {
      accent: {base: "qr-code--accent"},
      brand: {base: "qr-code--brand"},
      default: {base: "qr-code--default"},
      sunset: {base: "qr-code--sunset"},
    },
    shape: {
      dots: {base: "qr-code--dots"},
      rounded: {base: "qr-code--rounded"},
      square: {base: "qr-code--square"},
    },
    shimmer: {
      true: {base: "qr-code--shimmer"},
    },
    size: {
      lg: {base: "qr-code--lg"},
      md: {base: "qr-code--md"},
      sm: {base: "qr-code--sm"},
    },
  },
});

export type QRCodeVariants = VariantProps<typeof qrCodeVariants>;
