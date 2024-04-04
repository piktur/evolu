import { NanoIdGenerator, createDbWorker } from "@evolu/common";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Bip39Live } from "./PlatformLive.js";
import { expose } from "./ProxyWorker.js";
import { SqliteFactoryWeb } from "./SqliteLive.js";

const worker = createDbWorker.pipe(
  Effect.provide(Layer.mergeAll(SqliteFactoryWeb, Bip39Live)),
  Effect.provide(NanoIdGenerator.Live),
  Effect.runSync,
);

expose(worker);
