import { computeCut, type CutRequest } from '@slabs/core';

self.onmessage = (e: MessageEvent<{ id: number; req: CutRequest }>) => {
  const { id, req } = e.data;
  try {
    self.postMessage({ id, result: computeCut(req) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
