// Ported from @internationalized/number src/index.ts (react-spectrum, v3.6.8), Apache-2.0, © Adobe,
// plus react-stately `useNumberFieldState` (packages/react-stately/src/numberfield) as `createNumberFieldState`.
// Changes: .ts import specifiers; Rivet: number field state factory exported beside the formatter / parser.
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export type { NumberFormatOptions } from "./NumberFormatter.ts";

export { NumberFormatter } from "./NumberFormatter.ts";
export { NumberParser } from "./NumberParser.ts";

export type { NumberFieldProps, NumberFieldState, NumberFieldStateOptions, NumberFieldSync } from "./number-field-state.tsx";
export {
  createNumberFieldState,
  committedValue,
  inputValue,
  formattedValue,
  numberValue,
  minValue,
  maxValue,
  canIncrement,
  canDecrement,
  validate,
  setInputValue,
  setNumberValue,
  commit,
  increment,
  decrement,
  incrementToMax,
  decrementToMin,
} from "./number-field-state.tsx";
