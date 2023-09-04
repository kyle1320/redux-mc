import { IApplicationSpec, ClientStoreState, Action } from "@redux-mc/util";
import { metaActions } from "@redux-mc/util/lib/meta";
import { ClientStore } from "../ClientStore";
import { Dispatch, Middleware as ReduxMiddleware } from "redux";
import { ClientStoreInternalAction } from "../types";

/**
 * Redux middleware for mirroring actions to the server.
 * Also responsible for performing the handshake on connect.
 */
export function serverMirroringMiddleware<TSpec extends IApplicationSpec>(
  clientStore: ClientStore<TSpec>
): ReduxMiddleware<never, ClientStoreState<TSpec>, Dispatch<ClientStoreInternalAction<TSpec>>> {
  const actionQueue: Action[] = [];

  return () => (next) => (action) => {
    if (action.kind === "Meta") {
      switch (action.type) {
        case metaActions.connected.type: {
          clientStore.onConnected();
          const actions = actionQueue;
          actionQueue.length = 0;
          clientStore.getConnection()?.send(
            metaActions.handshakeRequest({
              queuedActions: actions
            })
          );
          break;
        }
        case metaActions.handshakeReply.type:
          if (action.payload.version !== clientStore.version) {
            clientStore.onVersionMismatch(clientStore.version, action.payload.version);
            return;
          }
          break;
        case metaActions.multiAction.type:
          // Note: if React < 18 needed, should enable batching here.
          for (const act of action.payload) {
            clientStore.dispatchFromServer(act);
          }
          break;
        case metaActions.disconnected.type:
          clientStore.onDisconnected();
          break;
      }
    }

    next(action);

    switch (action.kind) {
      case "L3":
        // If the action came from the server, don't send it back.
        if (clientStore.isActionFromServer(action)) break;
      // fall through
      case "Req": {
        const conn = clientStore.getConnection();
        if (!conn || !conn.send(action)) {
          actionQueue.push(action);
        }
        break;
      }
    }
  };
}
