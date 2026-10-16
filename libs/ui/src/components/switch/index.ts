// Ported from HeroUI v3.2.6 packages/react/src/components/switch/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
import { SwitchContent, SwitchControl, SwitchIcon, SwitchRoot, SwitchThumb } from "./switch.tsx";
import type { SwitchContentProps, SwitchControlProps, SwitchIconProps, SwitchRootProps, SwitchThumbProps } from "./switch.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Switch = Object.assign(SwitchRoot, {
  Root: SwitchRoot,
  Content: SwitchContent,
  Control: SwitchControl,
  Thumb: SwitchThumb,
  Icon: SwitchIcon,
});

export type Switch = {
  Props: SwitchRootProps;
  RootProps: SwitchRootProps;
  ContentProps: SwitchContentProps;
  ControlProps: SwitchControlProps;
  ThumbProps: SwitchThumbProps;
  IconProps: SwitchIconProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SwitchContent, SwitchControl, SwitchIcon, SwitchRoot, SwitchThumb };

export type {
  SwitchRootProps,
  SwitchRootProps as SwitchProps,
  SwitchContentProps,
  SwitchControlProps,
  SwitchThumbProps,
  SwitchIconProps,
  SwitchFieldRenderProps,
  SwitchButtonRenderProps,
  SwitchFieldRenderProps as SwitchRenderProps,
} from "./switch.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { switchVariants } from "../../../styles/src/components/switch/index.ts";

export type { SwitchVariants } from "../../../styles/src/components/switch/index.ts";
