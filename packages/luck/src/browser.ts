// Exposes the engine to the pages as window.LuckEngine (built into apps/web/public/luck-engine.js by `bun run build:luck`). The pages never draw a dice or a target in any other way.
import * as E from "./index";
(globalThis as unknown as { LuckEngine: typeof E }).LuckEngine = E;
