export type ActionKind = "L0" | "L1" | "L2" | "L3" | "L4" | "Req";

export type Action<TKind extends string = string, Type extends string = string, TPayload = unknown> = {
  kind: TKind;
  type: Type;
  payload: TPayload;
};

export type Reducer<TState extends object, TAction extends Action> = (state: TState, action: TAction) => TState;

export interface IApplicationSpec {
  state: {
    [Kind in Exclude<ActionKind, "Req">]: object;
  };
  actions: {
    [Kind in ActionKind]: Action<Kind>;
  };
}

export interface ClientMetaState {
  connected: boolean;
  error?: unknown;
  id: string;
  timeOffset: number;
}

export interface ClientStoreState<TSpec extends IApplicationSpec> {
  L1: TSpec["state"]["L1"];
  L2: TSpec["state"]["L2"];
  L3: TSpec["state"]["L3"];
  L4: TSpec["state"]["L4"];
  meta: ClientMetaState;
}

export interface ServerStoreState<TSpec extends IApplicationSpec> {
  L0: TSpec["state"]["L0"];
  L1: TSpec["state"]["L1"];
  L2: Record<string, TSpec["state"]["L2"]>;
  L3: Record<string, TSpec["state"]["L3"]>;
}
