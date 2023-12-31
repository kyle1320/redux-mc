import { Action, IApplicationSpec } from "../../util";
import { ClientStore } from "../ClientStore";

export interface IServerConnection<TSpec extends IApplicationSpec> {
  open(store: ClientStore<TSpec>): void;
  send(action: Action): boolean;
  close(): void;
}
