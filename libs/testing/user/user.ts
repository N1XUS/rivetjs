// Ported from react-spectrum (packages/@react-aria/test-utils/src/user.ts), Apache-2.0, © Adobe.
import {CheckboxGroupTester} from './checkboxgroup.ts';
import type {
  CheckboxGroupTesterOpts,
  ComboBoxTesterOpts,
  DialogTesterOpts,
  GridListTesterOpts,
  ListBoxTesterOpts,
  MenuTesterOpts,
  RadioGroupTesterOpts,
  SelectTesterOpts,
  TableTesterOpts,
  TabsTesterOpts,
  TreeTesterOpts,
  UserOpts
} from './types.ts';
import {ComboBoxTester} from './combobox.ts';
import {DialogTester} from './dialog.ts';
import {GridListTester} from './gridlist.ts';
import {ListBoxTester} from './listbox.ts';
import {MenuTester} from './menu.ts';
import {pointerMap} from './index.ts';
import {RadioGroupTester} from './radiogroup.ts';
import {SelectTester} from './select.ts';
import {TableTester} from './table.ts';
import {TabsTester} from './tabs.ts';
import {TreeTester} from './tree.ts';
import {userEvent} from '@testing-library/user-event';

let keyToUtil: {
  CheckboxGroup: typeof CheckboxGroupTester;
  ComboBox: typeof ComboBoxTester;
  Dialog: typeof DialogTester;
  GridList: typeof GridListTester;
  ListBox: typeof ListBoxTester;
  Menu: typeof MenuTester;
  RadioGroup: typeof RadioGroupTester;
  Select: typeof SelectTester;
  Table: typeof TableTester;
  Tabs: typeof TabsTester;
  Tree: typeof TreeTester;
} = {
  CheckboxGroup: CheckboxGroupTester,
  ComboBox: ComboBoxTester,
  Dialog: DialogTester,
  GridList: GridListTester,
  ListBox: ListBoxTester,
  Menu: MenuTester,
  RadioGroup: RadioGroupTester,
  Select: SelectTester,
  Table: TableTester,
  Tabs: TabsTester,
  Tree: TreeTester
} as const;
export type PatternNames = keyof typeof keyToUtil;

// Conditional type: https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
type Tester<T> = T extends 'CheckboxGroup'
  ? CheckboxGroupTester
  : T extends 'ComboBox'
    ? ComboBoxTester
    : T extends 'Dialog'
      ? DialogTester
      : T extends 'GridList'
        ? GridListTester
        : T extends 'ListBox'
          ? ListBoxTester
          : T extends 'Menu'
            ? MenuTester
            : T extends 'RadioGroup'
              ? RadioGroupTester
              : T extends 'Select'
                ? SelectTester
                : T extends 'Table'
                  ? TableTester
                  : T extends 'Tabs'
                    ? TabsTester
                    : T extends 'Tree'
                      ? TreeTester
                      : never;

type TesterOpts<T> = T extends 'CheckboxGroup'
  ? CheckboxGroupTesterOpts
  : T extends 'ComboBox'
    ? ComboBoxTesterOpts
    : T extends 'Dialog'
      ? DialogTesterOpts
      : T extends 'GridList'
        ? GridListTesterOpts
        : T extends 'ListBox'
          ? ListBoxTesterOpts
          : T extends 'Menu'
            ? MenuTesterOpts
            : T extends 'RadioGroup'
              ? RadioGroupTesterOpts
              : T extends 'Select'
                ? SelectTesterOpts
                : T extends 'Table'
                  ? TableTesterOpts
                  : T extends 'Tabs'
                    ? TabsTesterOpts
                    : T extends 'Tree'
                      ? TreeTesterOpts
                      : never;

let defaultAdvanceTimer = (waitTime: number | undefined) =>
  new Promise(resolve => setTimeout(resolve, waitTime));

export class User {
  private user;
  /**
   * The interaction type (mouse, touch, keyboard) that the test util user will use when interacting
   * with a component. This can be overridden at the aria pattern util level if needed.
   *
   * @default mouse
   */
  interactionType: UserOpts['interactionType'];
  /**
   * A function used by the test utils to advance timers during interactions. Required for certain
   * aria patterns (e.g. table).
   */
  advanceTimer: UserOpts['advanceTimer'];

  constructor(opts: UserOpts = {}) {
    let {interactionType, advanceTimer} = opts;
    this.user = userEvent.setup({delay: null, pointerMap});
    this.interactionType = interactionType;
    this.advanceTimer = advanceTimer || defaultAdvanceTimer;
  }

  /**
   * Creates an aria pattern tester, inheriting the options provided to the original user.
   */
  createTester<T extends PatternNames>(patternName: T, opts: TesterOpts<T>): Tester<T> {
    return new keyToUtil[patternName]({
      interactionType: this.interactionType,
      advanceTimer: this.advanceTimer,
      ...opts,
      user: this.user
    }) as Tester<T>;
  }
}
