/**
 * CAM-worker. All tung beräkning sker här så att UI:t aldrig fryser.
 * Kommunikation: WorkerInbound in, WorkerOutbound ut (se @desktopcam/core/protocol).
 */
import type { WorkerInbound, WorkerOutbound } from '@desktopcam/core';
import { loadEngine } from '../engine/loadEngine';
import { handle, type Progress } from './camHandler';

interface WorkerScope {
  postMessage(message: WorkerOutbound, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerInbound>) => void) | null;
}

const scope = self as unknown as WorkerScope;
const enginePromise = loadEngine();

scope.onmessage = async (event) => {
  const { id, request } = event.data;
  const progress: Progress = (value, message) => scope.postMessage({ id, kind: 'progress', value, message });
  try {
    const engine = await enginePromise;
    const { result, transfer } = await handle(engine, request, progress);
    scope.postMessage({ id, kind: 'result', result }, transfer);
  } catch (err) {
    scope.postMessage({ id, kind: 'error', error: err instanceof Error ? err.message : String(err) });
  }
};
