import {
  Action,
  ClientSpecificActionKinds,
  IApplicationSpec,
  Reducer,
  ServerStoreAction,
  ServerStoreAllowedActionKinds,
  ServerStoreState,
  SpecActions,
  clientSpecificActionKinds,
  clientToServerAllowedActionKinds
} from "../util";
import { metaActions } from "../util/meta";
import { Store, applyMiddleware, legacy_createStore } from "redux";
import {
  ServerStoreInternalAction,
  getTargetClientId,
  tagActionWithOriginatingClient,
  tagActionWithTargetClientId
} from "./types";
import { applicationMiddleware } from "./middlewares/applicationMiddleware";
import { clientMirroringMiddleware } from "./middlewares/clientMirroringMiddleware";
import { IClient } from "./clients";

export abstract class ServerStore<TSpec extends IApplicationSpec> {
  // Store should not be accessed directly for safety.
  //  - Actions should be dispatched via `ServerStore.dispatch(action)`.
  //  - State should be queried via e.g. `ServerStore.getL2State(client)`.
  private _store: Store<ServerStoreState<TSpec>, ServerStoreInternalAction<TSpec>>;

  private clients: IClient[] = [];
  private uniqueClients = new Set<string>();

  protected readonly syncIntervalDurationMs: number = 30000;
  private syncInterval: ReturnType<typeof setInterval>;

  /** Protocol version number. Used to check for mismatches between client & server versions. */
  public abstract readonly version: string;

  public constructor() {
    const initialState: ServerStoreState<TSpec> = {
      ...this.getInitialServerState(),
      L2: {},
      L3: {}
    };

    this._store = legacy_createStore(
      (state: ServerStoreState<TSpec> = initialState, action: ServerStoreInternalAction<TSpec>) => {
        switch (action.kind) {
          case "L0":
            return { ...state, L0: this.reduceL0(state.L0, action) };
          case "L1":
            return { ...state, L1: this.reduceL1(state.L1, action) };
          case "L2": {
            const id = getTargetClientId(action);
            if (id) {
              return {
                ...state,
                L2: { ...state.L2, [id]: this.reduceL2(state.L2[id], action) }
              };
            }
            break;
          }
          case "L3": {
            const id = getTargetClientId(action);
            if (id) {
              return {
                ...state,
                L3: { ...state.L3, [id]: this.reduceL3(state.L3[id], action) }
              };
            }
            break;
          }
          case "Meta":
            if (action.type === metaActions.connected.type) {
              const id = getTargetClientId(action);
              if (id) {
                // Don't overwrite pre-existing state.
                if (id in state.L2 && id in state.L3) break;

                const clientState = this.getInitialClientState(id, state);
                return {
                  ...state,
                  L2: { ...state.L2, [id]: clientState.L2 },
                  L3: { ...state.L3, [id]: clientState.L3 }
                };
              }
            }
            // TODO: when should client state be deleted? (possibly add a method and/or flag for this)
            break;
        }
        return state;
      },
      initialState as any,
      applyMiddleware(clientMirroringMiddleware(this), applicationMiddleware(this))
    );

    this.syncInterval = setInterval(() => this.clients.forEach((c) => c.sync()), this.syncIntervalDurationMs);
  }

  public dispose() {
    clearInterval(this.syncInterval);
    for (const client of this.clients) {
      client.close();
    }
    this.clients = [];
  }

  public abstract getInitialServerState(): Pick<TSpec["state"], "L0" | "L1">;
  public abstract getInitialClientState(
    clientId: string,
    state: ServerStoreState<TSpec>
  ): Pick<TSpec["state"], "L2" | "L3">;

  public abstract reduceL0: Reducer<TSpec["state"]["L0"], TSpec["actions"]["L0"]>;
  public abstract reduceL1: Reducer<TSpec["state"]["L1"], TSpec["actions"]["L1"]>;
  public abstract reduceL2: Reducer<TSpec["state"]["L2"], TSpec["actions"]["L2"]>;
  public abstract reduceL3: Reducer<TSpec["state"]["L3"], TSpec["actions"]["L3"]>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public handleL0(action: TSpec["actions"]["L0"]): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public handleL1(action: TSpec["actions"]["L1"]): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public handleL2(action: TSpec["actions"]["L2"], clientId: string): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public handleL3(action: TSpec["actions"]["L3"], clientId: string): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public handleReq(action: TSpec["actions"]["Req"], clientId: string): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onClientConnected(client: IClient): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onClientDisconnected(client: IClient): void {}

  public dispatchFromClient(action: Action, client: IClient) {
    if (action.kind !== "Meta" && !clientToServerAllowedActionKinds.has(action.kind as any)) {
      throw new Error("Client tried to dispatch disallowed action");
    }

    const serverAction = action as ServerStoreInternalAction<TSpec>;

    tagActionWithOriginatingClient(action, client);
    tagActionWithTargetClientId(action, client.id);

    this._store.dispatch(serverAction);
  }

  public dispatch(action: SpecActions<TSpec, ClientSpecificActionKinds>, clientId: string): void;
  public dispatch(action: SpecActions<TSpec, Exclude<ServerStoreAllowedActionKinds, ClientSpecificActionKinds>>): void;
  public dispatch(action: ServerStoreAction<TSpec>, clientId?: string) {
    if (clientSpecificActionKinds.has(action.kind as any)) {
      if (!clientId) {
        throw new Error("Client-specific actions (L2, L3, Req) must be dispatched with a client ID");
      }
      tagActionWithTargetClientId(action, clientId);
    }

    this._store.dispatch(action);
  }

  public addClient(client: IClient) {
    this.clients.push(client);
    if (!this.uniqueClients.has(client.id)) {
      this.uniqueClients.add(client.id);
      this.dispatchFromClient(metaActions.connected(), client);
    }
    //   if (this.deleteAfter && client.isHuman) {
    //     this.deleteAfter = null;
    //     this.onUnmarkForDeletion();
    //   }
  }

  public removeClient(client: IClient) {
    client.close();
    this.clients = this.clients.filter((x) => x !== client);
    if (!this.clients.some((c) => c.id === client.id)) {
      this.uniqueClients.delete(client.id);
      this.dispatchFromClient(metaActions.disconnected(), client);
    }
    //   if (!this.clients.some(c => c.isHuman) && !this.deleteAfter) {
    //     this.deleteAfter = Date.now() + 24 * 60 * 60 * 1000;
    //     this.onMarkForDeletion();
    //   }
  }

  public getState() {
    return this._store.getState();
  }

  public getL0State() {
    return this._store.getState().L0;
  }

  public getL1State() {
    return this._store.getState().L1;
  }

  public getL2State(clientId: string) {
    return this._store.getState().L2[clientId];
  }

  public getL3State(clientId: string) {
    return this._store.getState().L3[clientId];
  }

  public getClients(): Iterable<IClient> {
    return this.clients.values();
  }

  public isEmpty(countNonHumans = false) {
    return !this.clients.some((c) => c.isHuman || countNonHumans);
  }
}
