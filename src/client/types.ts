import { IApplicationSpec, SpecActions } from "../util";
import { MetaAction } from "../util/meta";

export type ClientStoreInternalAction<TSpec extends IApplicationSpec> =
  | SpecActions<TSpec, "L1" | "L2" | "L3" | "L4" | "Req">
  | MetaAction;
