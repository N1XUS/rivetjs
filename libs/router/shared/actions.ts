// Action results that are not success: returned by an action to answer with a 4xx status and data
// (validation failures). The page still renders (loaders run) and receives the data as the action
// result; enhanced (JSON) submits get `{ action: { name, result, status } }` with that status.

/** A failed action: HTTP `status` plus the data the page (or the enhanced submit) receives. */
export class ActionFailure<T = unknown> {
  declare readonly status: number;
  declare readonly data: T;
  constructor(status: number, data: T) {
    this.status = status;
    this.data = data;
  }
}

/** Fail an action with a 4xx status (e.g. 400 for invalid input) and the data to render. */
export function fail<T>(status: number, data: T): ActionFailure<T> {
  if (!Number.isInteger(status) || status < 400 || status > 499) throw new RangeError("fail() status must be 4xx");
  return new ActionFailure(status, data);
}
/** Whether a value is an `ActionFailure` returned by `fail()`. */
export const isActionFailure = (value: unknown): value is ActionFailure => value instanceof ActionFailure;
