import { Action } from "@redux-mc/util";

export interface IClient {
  readonly id: string;
  readonly isHuman: boolean;
  send(action: Action): void;
  sync(): void;
  close(): void;
}
