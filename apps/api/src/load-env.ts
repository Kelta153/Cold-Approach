import { config } from 'dotenv';

// A side-effect import (`import './load-env'`), not a function call inside main.ts's own body.
// Under real ESM evaluation (which tsx uses here), ALL of a file's import declarations — no
// matter where textually placed — are fully evaluated before ANY of that file's own top-level
// statements run. So `import {config} from 'dotenv'; config(...)` in main.ts would only run
// AFTER `import {AppModule} from './app.module'` (and everything it transitively imports,
// including queues.module.ts's `new IORedis(process.env.REDIS_URL ...)`) had already evaluated —
// too late. Doing the `config()` call here, inside this module's own top-level code, makes it
// part of the *import* evaluation phase instead, which Node processes in source order.
config({ path: '../../.env' });
