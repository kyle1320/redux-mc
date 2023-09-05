import { Action, IApplicationSpec, ServerStoreAction } from "../util";
import { MetaAction } from "../util/meta";
import { IClient } from "./clients";

export type ServerStoreInternalAction<TSpec extends IApplicationSpec> = ServerStoreAction<TSpec> | MetaAction;

const originatingClientSymbol = Symbol("Originating Client");
const targetClientIdSymbol = Symbol("Target Client ID");

export function tagActionWithOriginatingClient(action: Action, client: IClient) {
  (action as any)[originatingClientSymbol] = client;
}

export function getOriginatingClient(action: Action): IClient | undefined {
  return (action as any)[originatingClientSymbol];
}

export function tagActionWithTargetClientId(action: Action, id: string) {
  (action as any)[targetClientIdSymbol] = id;
}

export function getTargetClientId(action: Action): string | undefined {
  return (action as any)[targetClientIdSymbol];
}
