// `@rivetjs/cdk/qr-code`: QR Code encoder (port of Project Nayuki's QR Code generator library, MIT — see `./encode.ts`)
// + Rivet-authored symbol geometry and SVG path builders (`./shapes.ts`). Pure functions, no DOM, no state: identical
// output on server and client. `@rivetjs/ui/qr-code` renders them.
export {
  MAX_VERSION,
  MIN_VERSION,
  addEccAndInterleave,
  alignmentPositions,
  blockLayout,
  buildMatrix,
  encodeQr,
  encodeQrSegments,
  formatBits,
  makeAlphanumeric,
  makeBytes,
  makeNumeric,
  makeSegments,
  maskBit,
  numDataCodewords,
  numRawDataModules,
  penaltyScore,
  versionBits,
} from "./encode.ts";
export type { QrEcc, QrEncodeOptions, QrMatrix, QrMode, QrSegment } from "./encode.ts";
export { centerRect, excavate, finderOrigins, isFinderModule, moduleRole, placeholderQr, qrPaths } from "./shapes.ts";
export type { QrExcavateOptions, QrModuleRole, QrModules, QrPaths, QrRect, QrShape } from "./shapes.ts";
