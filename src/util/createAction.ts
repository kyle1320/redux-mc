import { ActionKindCreator } from "./actions";

// This is in its own file since it should not be exported directly from the package.
export const createAction: ActionKindCreator =
  (kind) =>
  (type) =>
  <TPayload>() =>
    Object.assign((payload: TPayload) => ({ kind, type, payload }) as any, { type });
