import { Action, ActionKind, IApplicationSpec } from "./types";

export type SpecActions<TSpec extends IApplicationSpec, Kind extends string> = Kind extends ActionKind
  ? TSpec["actions"][Kind]
  : never;

export const clientSpecificActionKinds = new Set(["L2", "L3", "Req"] as const);
export type ClientSpecificActionKinds = typeof clientSpecificActionKinds extends Set<infer T> ? T : never;

export const serverStoreAllowedActionKinds = new Set(["L0", "L1", "L2", "L3", "Req"] as const);
export type ServerStoreAllowedActionKinds = typeof serverStoreAllowedActionKinds extends Set<infer T> ? T : never;
export type ServerStoreAction<TSpec extends IApplicationSpec> = SpecActions<TSpec, ServerStoreAllowedActionKinds>;

export const clientToServerAllowedActionKinds = new Set(["L3", "Req"] as const);

export const clientAppAllowedActionKinds = new Set(["L3", "L4", "Req"] as const);
type ClientAppAllowedActionKinds = typeof clientAppAllowedActionKinds extends Set<infer T> ? T : never;
export type ClientAppAction<TSpec extends IApplicationSpec> = SpecActions<TSpec, ClientAppAllowedActionKinds>;

export type ActionKindCreator = <Kind extends string>(kind: Kind) => ActionTypeCreator<Kind>;
export type ActionTypeCreator<Kind extends string> = <Type extends string>(
  type: Type
) => ActionPayloadCreator<Kind, Type>;
export type ActionPayloadCreator<Kind extends string, Type extends string> = <TPayload>() => ActionCreator<
  Kind,
  Type,
  TPayload
>;
export type ActionCreator<Kind extends string, Type extends string, TPayload> = {
  (payload: TPayload): Action<Kind, Type, TPayload>;
  type: Type;
};

export type ActionKindOf<A> = A extends ActionCreator<infer Kind, any, any> ? Kind : never;
export type ActionTypeOf<A> = A extends ActionCreator<any, infer Type, any> ? Type : never;
export type ActionPayloadOf<A> = A extends ActionCreator<any, any, infer TPayload> ? TPayload : never;
export type ActionFrom<AC extends ActionCreator<any, any, any>> = AC extends ActionCreator<
  infer TKind,
  infer Type,
  infer TPayload
>
  ? Action<TKind, Type, TPayload>
  : never;
export type AllActions<R extends Record<any, ActionCreator<any, any, any>>> = ActionFrom<R[keyof R]>;
