// Ported from react-resizable-panels (lib/types.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
export type Dimensions = {
  height: number;
  width: number;
};

export type Point = {
  x: number;
  y: number;
};

export type PointerPrecision = {
  coarse: number;
  precise: number;
};

export type Rect = Dimensions & Point;
