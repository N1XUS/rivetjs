// Ported from HeroUI v3.2.6 packages/react/src/components/toast/constants.ts (Apache-2.0, © 2025 NextUI Inc.).
// Gap between toasts in pixels.
export const DEFAULT_GAP = 12;

// Visual cap on rendered toasts; older ones fade out but keep running.
export const DEFAULT_MAX_VISIBLE_TOAST = 3;

// The stately queue keeps every toast; visibility is applied per toast.
export const DEFAULT_RAC_MAX_VISIBLE_TOAST = Number.MAX_SAFE_INTEGER;

// How much each toast behind the front one scales down.
export const DEFAULT_SCALE_FACTOR = 0.05;

// Toast width in pixels.
export const DEFAULT_TOAST_WIDTH = 460;

// Auto-dismiss timeout in milliseconds.
export const DEFAULT_TOAST_TIMEOUT = 4000;

// Rivet: fallback for how long a closing toast stays mounted, in milliseconds, when no
// rendered toast reports the end of its exit: a mounted Toast unmounts when its CSS exit
// animations finish (MOTION-HARMONY: timing lives in toast.css only).
export const DEFAULT_EXIT_DURATION = 300;

// Modifiers match KeyboardEvent boolean props; other keys match event.code.
export const DEFAULT_HOTKEY: string[] = ["altKey", "KeyT"];
