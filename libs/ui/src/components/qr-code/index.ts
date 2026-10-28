// Rivet addition (no HeroUI v3.2.6 counterpart): QR code from a `value`, three module shapes, gradient presets, centred icon,
// loading placeholder + shimmer. `@rivetjs/ui/qr-code`: `QRCode`, `QRCodeRoot`, prop types, `qrCodeVariants`.
import { QRCodeRoot } from "./qr-code.tsx";
import type { QRCodeRootProps } from "./qr-code.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const QRCode = Object.assign(QRCodeRoot, {
  Root: QRCodeRoot,
});

export type QRCode = {
  Props: QRCodeRootProps;
  RootProps: QRCodeRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { QRCodeRoot } from "./qr-code.tsx";
export type { QRCodeRootProps, QRCodeRootProps as QRCodeProps } from "./qr-code.tsx";
export type { QrEcc as QRCodeEcc, QrShape as QRCodeShape } from "@rivetjs/cdk/qr-code";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { qrCodeVariants } from "../../../styles/src/components/qr-code/index.ts";

export type { QRCodeVariants } from "../../../styles/src/components/qr-code/index.ts";
