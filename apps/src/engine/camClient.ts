import type { CamRequest, CamResponseMap, EngineInfo, WorkerInbound, WorkerOutbound } from '@desktopcam/core';

type RequestType = CamRequest['type'];

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  onProgress?: (value: number, message?: string) => void;
}

export interface RequestOptions {
  onProgress?: (value: number, message?: string) => void;
  transfer?: Transferable[];
}

/**
 * Promise-baserad klient mot CAM-workern. En worker per app; anrop får ett
 * löpnummer så att svar och förlopp hamnar hos rätt anropare.
 */
class CamClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('../workers/cam.worker.ts', import.meta.url), {
      type: 'module',
      name: 'desktopcam-cam',
    });
    worker.onmessage = (e: MessageEvent<WorkerOutbound>) => this.handle(e.data);
    worker.onerror = (e) => this.failAll(new Error(e.message || 'CAM-workern kraschade'));
    this.worker = worker;
    return worker;
  }

  private handle(msg: WorkerOutbound) {
    const p = this.pending.get(msg.id);
    if (!p) return;
    if (msg.kind === 'progress') {
      p.onProgress?.(msg.value, msg.message);
      return;
    }
    this.pending.delete(msg.id);
    if (msg.kind === 'result') p.resolve(msg.result);
    else p.reject(new Error(msg.error));
  }

  private failAll(err: Error) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  request<T extends RequestType>(
    request: Extract<CamRequest, { type: T }>,
    options: RequestOptions = {},
  ): Promise<CamResponseMap[T]> {
    const worker = this.ensureWorker();
    const id = ++this.seq;
    return new Promise<CamResponseMap[T]>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress: options.onProgress });
      const msg: WorkerInbound = { id, request };
      worker.postMessage(msg, options.transfer ?? []);
    });
  }

  ping(): Promise<EngineInfo> {
    return this.request({ type: 'ping' });
  }

  /** Avbryter alla pågående beräkningar genom att starta om workern. */
  restart() {
    this.worker?.terminate();
    this.worker = null;
    this.failAll(new Error('Beräkningen avbröts'));
  }
}

export const camClient = new CamClient();
