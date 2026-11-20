/**
 * Map.prototype.getOrInsert / getOrInsertComputed (TC39-förslaget "upsert")
 * används av flo-mat men finns inte i alla webbläsare än. Egen kod: två rader.
 */
type Upsert = Map<unknown, unknown> & {
  getOrInsert?: (k: unknown, v: unknown) => unknown;
  getOrInsertComputed?: (k: unknown, f: (k: unknown) => unknown) => unknown;
};
const proto = Map.prototype as Upsert;
proto.getOrInsert ??= function (this: Map<unknown, unknown>, k: unknown, v: unknown) {
  if (!this.has(k)) this.set(k, v);
  return this.get(k);
};
proto.getOrInsertComputed ??= function (this: Map<unknown, unknown>, k: unknown, f: (k: unknown) => unknown) {
  if (!this.has(k)) this.set(k, f(k));
  return this.get(k);
};
export {};
