// Ported from react-spectrum (packages/@react-aria/test-utils/src/dialog.ts), Apache-2.0, © Adobe.
import {act} from './act.ts';
import type {DialogTesterOpts, UserOpts} from './types.ts';
import {waitFor, within} from '@testing-library/dom';

interface DialogOpenOpts {
  /**
   * What interaction type to use when opening the dialog. Defaults to the interaction type set on
   * the tester.
   */
  interactionType?: UserOpts['interactionType'];
}

export class DialogTester {
  private user;
  private _interactionType: UserOpts['interactionType'];
  private _trigger: HTMLElement | undefined;
  private _dialog: HTMLElement | undefined;
  private _overlayType: DialogTesterOpts['overlayType'];

  constructor(opts: DialogTesterOpts) {
    let {root, user, interactionType, overlayType} = opts;
    this.user = user;
    this._interactionType = interactionType || 'mouse';
    this._overlayType = overlayType || 'modal';

    // Handle case where element provided is a wrapper of the trigger button.
    let buttons = within(root).queryAllByRole('button');
    let triggerButton: HTMLElement | undefined;
    if (buttons.length === 0) {
      triggerButton = root;
    } else if (buttons.length === 1) {
      triggerButton = buttons[0];
    } else {
      triggerButton = buttons.find(button => button.hasAttribute('aria-haspopup'));
    }
    this._trigger = triggerButton ?? root;
  }

  /**
   * Set the interaction type used by the dialog tester.
   */
  setInteractionType(type: UserOpts['interactionType']): void {
    this._interactionType = type;
  }

  /**
   * Opens the dialog. Defaults to using the interaction type set on the dialog tester.
   */
  async open(opts: DialogOpenOpts = {}): Promise<void> {
    let {interactionType = this._interactionType} = opts;
    let trigger = this.getTrigger();
    if (!trigger.hasAttribute('disabled')) {
      if (interactionType === 'mouse') {
        await this.user.click(trigger);
      } else if (interactionType === 'touch') {
        await this.user.pointer({target: trigger, keys: '[TouchA]'});
      } else if (interactionType === 'keyboard') {
        act(() => trigger.focus());
        await this.user.keyboard('[Enter]');
      }

      if (this._overlayType === 'popover') {
        await waitFor(() => {
          if (trigger.getAttribute('aria-controls') == null) {
            throw new Error('No aria-controls found on dialog trigger element.');
          } else {
            return true;
          }
        });

        let dialogId = trigger.getAttribute('aria-controls');
        await waitFor(() => {
          if (!dialogId || document.getElementById(dialogId) == null) {
            throw new Error(`Dialog with id of ${dialogId} not found in document.`);
          } else {
            this._dialog = document.getElementById(dialogId)!;
            return true;
          }
        });
      } else {
        let dialog = null as HTMLElement | null;
        await waitFor(() => {
          dialog = document.querySelector<HTMLElement>('[role=dialog], [role=alertdialog]');
          if (dialog == null) {
            throw new Error(
              'No dialog of type role="dialog" or role="alertdialog" found after pressing the trigger.'
            );
          } else {
            return true;
          }
        });

        if (
          dialog &&
          document.activeElement !== this._trigger &&
          dialog.contains(document.activeElement)
        ) {
          this._dialog = dialog;
        } else {
          throw new Error(
            'New modal dialog doesnt contain the active element OR the active element is still the trigger. Uncertain if the proper modal dialog was found'
          );
        }
      }
    }
  }

  /**
   * Closes the dialog via the Escape key.
   */
  async close(): Promise<void> {
    let dialog = this._dialog;
    if (dialog) {
      await this.user.keyboard('[Escape]');
      await waitFor(() => {
        if (document.contains(dialog)) {
          throw new Error('Expected the dialog to not be in the document after closing it.');
        } else {
          this._dialog = undefined;
          return true;
        }
      });
    }
  }

  /**
   * Returns the dialog's trigger.
   */
  getTrigger(): HTMLElement {
    if (!this._trigger) {
      throw new Error('No trigger element found for dialog.');
    }

    return this._trigger;
  }

  /**
   * Returns the dialog if present.
   */
  getDialog(): HTMLElement | null {
    return this._dialog && document.contains(this._dialog) ? this._dialog : null;
  }
}
