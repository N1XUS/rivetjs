// Ported from Angular Components (src/cdk/drag-drop/directives/config.ts), MIT, © Google LLC.
// Rivet: the `CDK_DRAG_CONFIG` injection token is `DragDropConfigContext` (provide it with
// `<Provider token={DragDropConfigContext} value={…}>` + function children, or `provide()`); `Drag` /
// `DropList` read it while rendering, so the config is captured with their handlers and resumes.
import { createContext } from "@rivetjs/reactivity";
import type { DragConstrainPosition, DragRefConfig } from "../drag-ref.ts";
import type { DropListOrientation } from "../drop-list-ref.ts";

export type { DropListOrientation };

/** Possible values that can be used to configure the drag start delay. */
export type DragStartDelay = number | { touch: number; mouse: number };

/** Possible axis along which dragging can be locked. */
export type DragAxis = "x" | "y";

/**
 * Object that can be used to configure the drag
 * items and drop lists within a module or a component.
 */
export interface DragDropConfig extends Partial<DragRefConfig> {
  lockAxis?: DragAxis | null;
  dragStartDelay?: DragStartDelay;
  constrainPosition?: DragConstrainPosition;
  previewClass?: string | string[];
  boundaryElement?: string;
  rootElementSelector?: string;
  draggingDisabled?: boolean;
  sortingDisabled?: boolean;
  listAutoScrollDisabled?: boolean;
  listOrientation?: DropListOrientation;
  zIndex?: number;
  previewContainer?: "global" | "parent";
}

/** Injection token that can be used to configure the behavior of the drag&drop-related components (Angular `CDK_DRAG_CONFIG`). */
export const DragDropConfigContext = createContext<DragDropConfig | null>(null);
