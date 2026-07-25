import type { ServerIOLike, ServerSocketLike } from "../../src/network/SocketHandlers.js";

class EventBus {
  private readonly handlers = new Map<string, Array<(payload?: unknown) => void>>();

  on(event: string, handler: (payload?: unknown) => void): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  emit(event: string, payload?: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(payload);
    }
  }
}

/** テスト用の「クライアント側ソケット」。実際のsocket.io-clientの代わりに使う。 */
export class FakeClientSocket {
  constructor(
    private readonly toServer: EventBus,
    private readonly toClient: EventBus,
  ) {}

  emit(event: string, payload?: unknown): void {
    this.toServer.emit(event, payload);
  }

  on(event: string, handler: (payload?: unknown) => void): void {
    this.toClient.on(event, handler);
  }

  /** 次にサーバーから飛んでくるeventを1件だけPromiseで待つ。 */
  once<T = unknown>(event: string): Promise<T> {
    return new Promise((resolve) => {
      this.toClient.on(event, (payload) => resolve(payload as T));
    });
  }

  /** 実ネットワークの切断をシミュレートする(サーバー側のdisconnectハンドラを発火させる)。 */
  simulateDisconnect(): void {
    this.toServer.emit("disconnect");
  }
}

/** テスト用の「サーバーIO」。registerSocketHandlers(io, registry)にそのまま渡せる。 */
export class FakeIO implements ServerIOLike {
  private connectionHandler: ((socket: ServerSocketLike) => void) | undefined;
  private nextId = 1;

  on(_event: "connection", handler: (socket: ServerSocketLike) => void): void {
    this.connectionHandler = handler;
  }

  connect(): FakeClientSocket {
    const toServer = new EventBus();
    const toClient = new EventBus();
    const socketId = `fake-socket-${this.nextId++}`;

    const serverSocket: ServerSocketLike = {
      id: socketId,
      on: (event, handler) => toServer.on(event, handler as (payload?: unknown) => void),
      emit: (event, payload) => toClient.emit(event, payload),
    };

    if (!this.connectionHandler) {
      throw new Error("FakeIO: no connection handler registered yet");
    }
    this.connectionHandler(serverSocket);

    return new FakeClientSocket(toServer, toClient);
  }
}
