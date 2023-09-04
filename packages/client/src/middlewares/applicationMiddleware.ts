import { ClientStoreState, IApplicationSpec } from "@redux-mc/util";
import { ClientStore } from "../ClientStore";
import { Dispatch, Middleware as ReduxMiddleware } from "redux";
import { ClientStoreInternalAction } from "../types";

/**
 * Redux middleware for invoking application middleware.
 */
export function applicationMiddleware<TSpec extends IApplicationSpec>(
  clientStore: ClientStore<TSpec>
): ReduxMiddleware<never, ClientStoreState<TSpec>, Dispatch<ClientStoreInternalAction<TSpec>>> {
  return () => (next) => (action: ClientStoreInternalAction<TSpec>) => {
    next(action);

    switch (action.kind) {
      case "L1":
        clientStore.handleL1(action);
        break;
      case "L2":
        clientStore.handleL2(action);
        break;
      case "L3":
        clientStore.handleL3(action);
        break;
      case "L4":
        clientStore.handleL4(action);
        break;
    }
  };
}
