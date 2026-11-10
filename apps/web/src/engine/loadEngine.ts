import { createReferenceEngine, type CamEngine } from '@desktopcam/core';
import { createWasmEngine } from './wasmEngine';

/** Försöker med Wasm först, faller tillbaka på TypeScript-motorn. */
export async function loadEngine(): Promise<CamEngine> {
  try {
    return await createWasmEngine();
  } catch (err) {
    console.info('[desktopCAM] Wasm-motorn är inte byggd – använder TypeScript-motorn.', err);
    return createReferenceEngine();
  }
}
