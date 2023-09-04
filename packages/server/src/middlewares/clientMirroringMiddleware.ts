import { Action, IApplicationSpec, ServerStoreState } from "@redux-mc/util";
import { metaActions } from "@redux-mc/util/lib/meta";
import { Dispatch, Middleware as ReduxMiddleware } from "redux";
import { ServerStoreInternalAction, getOriginatingClient, getTargetClientId } from "../types";
import { IClient } from "../clients";
import { ServerStore } from "../ServerStore";

/**
 * Redux middleware for mirroring actions to all clients.
 * Also responsible for performing handshakes on client connect.
 */
export function clientMirroringMiddleware<TSpec extends IApplicationSpec>(
  serverStore: ServerStore<TSpec>
): ReduxMiddleware<never, ServerStoreState<TSpec>, Dispatch<ServerStoreInternalAction<TSpec>>> {
  const actionMap = new Map<IClient, Action[]>();
  let depth = 0;

  function pushAction(client: IClient, action: Action) {
    if (actionMap.has(client)) actionMap.get(client)!.push(action);
    else actionMap.set(client, [action]);
  }

  return () => (next) => (action: ServerStoreInternalAction<TSpec>) => {
    depth++;
    const from = getOriginatingClient(action);
    const id = getTargetClientId(action);
    switch (action.kind) {
      case "L1": // send to all clients
        for (const client of serverStore.getClients()) {
          pushAction(client, action);
        }
        break;
      case "L2": // send to one client
        for (const client of serverStore.getClients()) {
          if (client.id === id) {
            pushAction(client, action);
          }
        }
        break;
      case "L3": // send to one client (if not from that client)
        for (const client of serverStore.getClients()) {
          if (client.id === id && client !== from) {
            pushAction(client, action);
          }
        }
        break;
    }

    next(action);

    if (action.kind === "Meta" && action.type === metaActions.connected.type) {
      serverStore.onClientConnected(getOriginatingClient(action)!);
    }

    if (action.kind === "Meta" && action.type === metaActions.disconnected.type) {
      serverStore.onClientDisconnected(getOriginatingClient(action)!);
    }

    if (action.kind === "Meta" && action.type === metaActions.handshakeRequest.type) {
      const client = getOriginatingClient(action)!;

      // Dispatch queued actions from the client.
      for (const act of action.payload.queuedActions) {
        serverStore.dispatchFromClient(act, client);
      }

      // Don't send queued actions resulting from the handshake.
      // Instead these will be sent as part of the initial state.
      actionMap.delete(from!);

      // Post initial state to the client.
      client.send(
        metaActions.handshakeReply({
          initialState: {
            L1: serverStore.getL1State(),
            L2: serverStore.getL2State(client.id),
            L3: serverStore.getL3State(client.id)
          },
          version: serverStore.version,
          id: client.id
        })
      );
    }

    // When actions are triggered recursively (via e.g. application middlewares),
    // we want to just gather the actions, and only send them after we are all done.
    depth--;
    if (depth == 0) {
      for (const client of actionMap.keys()) {
        const actions = actionMap.get(client)!;
        if (actions.length === 0) {
          continue;
        } else if (actions.length === 1) {
          client.send(actions[0]);
        } else {
          client.send(metaActions.multiAction(actions));
        }
      }
      actionMap.clear();
    }
  };
}
