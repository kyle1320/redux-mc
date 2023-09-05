import { IApplicationSpec, ServerStoreState } from "../../util";
import { ServerStore } from "../ServerStore";
import { Dispatch, Middleware as ReduxMiddleware } from "redux";
import { ServerStoreInternalAction, getTargetClientId } from "../types";

/**
 * Redux middleware for invoking application middleware.
 */
export function applicationMiddleware<TSpec extends IApplicationSpec>(
  serverStore: ServerStore<TSpec>
): ReduxMiddleware<never, ServerStoreState<TSpec>, Dispatch<ServerStoreInternalAction<TSpec>>> {
  return () => (next) => (action: ServerStoreInternalAction<TSpec>) => {
    next(action);

    const id = getTargetClientId(action);
    switch (action.kind) {
      case "L0":
        serverStore.handleL0(action);
        break;
      case "L1":
        serverStore.handleL1(action);
        break;
      case "L2":
        if (id) {
          serverStore.handleL2(action, id);
        }
        break;
      case "L3":
        if (id) {
          serverStore.handleL3(action, id);
        }
        break;
      case "Req":
        if (id) {
          serverStore.handleReq(action, id);
        }
        break;
    }
  };
}
