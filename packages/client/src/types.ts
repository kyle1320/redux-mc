import { IApplicationSpec, SpecActions } from "@redux-mc/util";
import { MetaAction } from "@redux-mc/util/lib/meta";

export type ClientStoreInternalAction<TSpec extends IApplicationSpec> =
  | SpecActions<TSpec, "L1" | "L2" | "L3" | "L4" | "Req">
  | MetaAction;
