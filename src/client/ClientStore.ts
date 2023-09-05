import {
  Action,
  ClientAppAction,
  ClientMetaState,
  ClientStoreState,
  IApplicationSpec,
  Reducer,
  clientAppAllowedActionKinds
} from "../util";
import { MetaAction, metaActions } from "../util/meta";
import { Store, applyMiddleware, legacy_createStore } from "redux";
import { ClientStoreInternalAction } from "./types";
import { serverMirroringMiddleware } from "./middlewares/serverMirroringMiddleware";
import { applicationMiddleware } from "./middlewares/applicationMiddleware";
import { IServerConnection } from "./conn";

const serverTagSymbol = Symbol("From Server?");

export abstract class ClientStore<TSpec extends IApplicationSpec> {
  // Internally typed store can accept any action.
  private readonly _store: Store<ClientStoreState<TSpec>, ClientStoreInternalAction<TSpec>>;

  /** Protocol version number. Used to check for mismatches between client & server versions. */
  public abstract readonly version: string;

  private conn: IServerConnection<TSpec> | null = null;

  public constructor() {
    const initialState: ClientStoreState<TSpec> = {
      ...this.getInitialState(),
      meta: {
        connected: false,
        id: "",
        timeOffset: 0,
        error: undefined
      }
    };

    this._store = legacy_createStore(
      (state: ClientStoreState<TSpec> = initialState, action: ClientStoreInternalAction<TSpec>) => {
        const time = (action as any)._time;
        if (time && typeof time === "number") {
          state = { ...state, meta: { ...state.meta, timeOffset: time - Date.now() } };
        }

        switch (action.kind) {
          case "L1":
            return { ...state, L1: this.reduceL1(state.L1, action) };
          case "L2":
            return { ...state, L2: this.reduceL2(state.L2, action) };
          case "L3":
            return { ...state, L3: this.reduceL3(state.L3, action) };
          case "L4":
            return { ...state, L4: this.reduceL4(state.L4, action) };
          case "Meta":
            if (action.type === metaActions.handshakeReply.type) {
              return {
                ...state,
                ...action.payload.initialState,
                meta: {
                  ...state.meta,
                  id: action.payload.id
                }
              };
            } else {
              return { ...state, meta: this.reduceMeta(state.meta, action) };
            }
        }

        return state;
      },
      initialState as any,
      applyMiddleware(serverMirroringMiddleware(this), applicationMiddleware(this))
    );
  }

  public getConnection(): IServerConnection<TSpec> | null {
    return this.conn;
  }

  public dispose() {
    this.conn?.close();
  }

  public abstract getInitialState(): Pick<TSpec["state"], "L1" | "L2" | "L3" | "L4">;

  public abstract reduceL1: Reducer<TSpec["state"]["L1"], TSpec["actions"]["L1"]>;
  public abstract reduceL2: Reducer<TSpec["state"]["L2"], TSpec["actions"]["L2"]>;
  public abstract reduceL3: Reducer<TSpec["state"]["L3"], TSpec["actions"]["L3"]>;
  public abstract reduceL4: Reducer<TSpec["state"]["L4"], TSpec["actions"]["L4"]>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public handleL1(action: TSpec["actions"]["L1"]): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public handleL2(action: TSpec["actions"]["L2"]): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public handleL3(action: TSpec["actions"]["L3"]): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public handleL4(action: TSpec["actions"]["L4"]): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public abstract onVersionMismatch(client: string, server: string): void;

  public onConnected(): void {}
  public onDisconnected(): void {}

  // Externally typed store can only accept L3, L4, and Req actions.
  public get store(): Store<ClientStoreState<TSpec>, ClientAppAction<TSpec>> {
    return this._store as any;
  }

  public dispatchFromServer(action: Action) {
    const clientAction = action as ClientStoreInternalAction<TSpec>;
    (clientAction as any)[serverTagSymbol] = true;
    this._store.dispatch(clientAction);
  }

  public dispatch(action: ClientAppAction<TSpec>) {
    if (!clientAppAllowedActionKinds.has(action.kind)) {
      throw new Error("Tried to dispatch disallowed action from client");
    }

    this.store.dispatch(action);
  }

  public dispatchError(error?: unknown) {
    this._store.dispatch(metaActions.error(error));
  }

  public connect(conn: IServerConnection<TSpec>) {
    this.conn = conn;
    conn.open(this);
  }

  public isActionFromServer(action: Action) {
    return !!(action as any)[serverTagSymbol];
  }

  private reduceMeta(state: ClientMetaState, action: MetaAction): ClientMetaState {
    switch (action.type) {
      case metaActions.connected.type:
        return { ...state, connected: true };
      case metaActions.disconnected.type:
        return { ...state, connected: false };
      case metaActions.error.type:
        return { ...state, error: action.payload };
    }
    return state;
  }
}
