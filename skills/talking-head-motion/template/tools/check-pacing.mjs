// 旧入口，保留是为了不让以前的写法失效。节奏检查已经并进总检查器：npm run check（tools/lint.mjs）。
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const r = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'lint.mjs'), ...process.argv.slice(2)], {stdio: 'inherit'});
process.exit(r.status ?? 1);
