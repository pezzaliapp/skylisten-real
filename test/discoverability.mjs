/*
 * Test di scopribilità e link:
 *  1) la pagina lora.html rende la fonte unica docs/HARDWARE-LORA.md (renderer);
 *  2) la home espone la demo LoRa e il link al piano;
 *  3) i link reciproci esistono e i nuovi asset rispondono 200 via HTTP;
 *  4) i nuovi asset sono nel service worker.
 *
 * Uso:  npm run test:links   (oppure: node test/discoverability.mjs)
 * Exit 0 = ok, 1 = fallito.
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderMarkdown } from '../js/mdview.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let failed = false;
const ok = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); failed = true; } };

// 1) Renderer della fonte unica -----------------------------------------------
const md = read('docs/HARDWARE-LORA.md');
const html = renderMarkdown(md);
const noPre = html.replace(/<pre>[\s\S]*?<\/pre>/g, '');
ok(['Fase 1', 'Fase 2', 'Fase 3', 'Leggi prima questo'].every((s) => html.includes(s)), 'lora render: fasi/box mancanti');
ok(/<table>/.test(html) && /<pre>/.test(html), 'lora render: tabelle o blocchi codice mancanti');
ok(!/\*\*/.test(noPre), 'lora render: markdown grezzo (**) non convertito');

// 2) Scopribilità dalla home --------------------------------------------------
const index = read('index.html');
ok(index.includes('Demo rete LoRa'), 'index: manca la card "Demo rete LoRa"');
ok(index.includes('mappa.html?lora-sim=1'), 'index: manca il link diretto alla demo');
ok(index.includes('href="lora.html"'), 'index: manca il link alla pagina LoRa');

// 3) Link reciproci -----------------------------------------------------------
ok(read('lora.html').includes('js/mdview.js') && read('lora.html').includes('docs/HARDWARE-LORA.md'),
  'lora.html: non rende la fonte .md');
ok(read('mappa.html').includes('href="lora.html"'), 'mappa.html: manca il link a lora.html');
ok(read('manuale.html').includes('href="lora.html"'), 'manuale.html: manca il link a lora.html');

// 4) Service worker -----------------------------------------------------------
const sw = read('sw.js');
ok(["'lora.html'", "'js/mdview.js'", "'docs/HARDWARE-LORA.md'"].every((s) => sw.includes(s)),
  'sw.js: nuovi asset non in CORE_ASSETS');

// 5) HTTP 200 sui nuovi percorsi ----------------------------------------------
const PORT = 8803;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1000));
try {
  for (const path of ['index.html', 'lora.html', 'js/mdview.js', 'docs/HARDWARE-LORA.md', 'mappa.html', 'mappa.html?lora-sim=1']) {
    const res = await fetch(`http://127.0.0.1:${PORT}/${path}`);
    ok(res.status === 200, `HTTP ${res.status} su /${path}`);
  }
} finally {
  server.kill('SIGTERM');
}

console.log(failed ? 'TEST FALLITO' : 'TEST OK: demo scopribile dalla home, pagina LoRa renderizzata, link e asset a posto');
process.exit(failed ? 1 : 0);
