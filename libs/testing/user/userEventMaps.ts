// Ported from react-spectrum (packages/@react-aria/test-utils/src/userEventMaps.ts), Apache-2.0, © Adobe.
import type {pointerKey} from '@testing-library/user-event';

export let pointerMap: pointerKey[] = [
  {name: 'MouseLeft', pointerType: 'mouse', button: 'primary'},
  {name: 'MouseRight', pointerType: 'mouse', button: 'secondary'},
  {name: 'MouseMiddle', pointerType: 'mouse', button: 'auxiliary'},
  {name: 'TouchA', pointerType: 'touch', height: 1, width: 1},
  {name: 'TouchB', pointerType: 'touch'},
  {name: 'TouchC', pointerType: 'touch'}
] as unknown as pointerKey[];
