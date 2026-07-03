import { EventEmitter } from "events";

class ProgressEmitter extends EventEmitter {}

const globalForEmitter = globalThis as unknown as { emitter: ProgressEmitter | undefined };

export const progressEmitter = globalForEmitter.emitter ?? new ProgressEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.emitter = progressEmitter;
}
