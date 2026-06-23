'use strict';

/**
 * js/mdview.js — renderer Markdown→HTML compatto e runtime-agnostico.
 *
 * Serve a mostrare un file `.md` del repo come pagina leggibile del sito senza
 * duplicarne il contenuto: la pagina (es. lora.html) carica il Markdown e lo
 * rende qui. Così la fonte resta UNICA (il `.md`) e non si creano versioni
 * divergenti. Niente dipendenze esterne.
 *
 * Supporta il sottoinsieme di Markdown usato nei doc del progetto: titoli,
 * paragrafi, **grassetto**, *corsivo*, `code`, [link](url), liste ordinate e
 * non (con blocchi di codice annidati), blocchi ``` ``` , tabelle, citazioni
 * `>` (anche annidate) e righe orizzontali `---`.
 */

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Formattazione inline su una singola riga. I `code span` sono protetti con un
 * segnaposto (NUL) così grassetto/corsivo/link possono attraversarli (es.
 * `**testo `code`**`), senza che il loro contenuto venga riformattato.
 */
function inline(text) {
  const NUL = String.fromCharCode(0);
  let s = escapeHtml(text);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return NUL + (codes.length - 1) + NUL; });
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => `<a href="${u}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(new RegExp(NUL + '(\\d+)' + NUL, 'g'), (m, i) => `<code>${codes[+i]}</code>`);
  return s;
}

const leading = (s) => s.match(/^ */)[0].length;
const slug = (s) => s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
const itemMatch = (l) => /^(\s*)(\d+\.|[-*])(\s+)(.*)$/.exec(l);

function renderTable(rows) {
  const cells = (r) => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]);
  let h = '<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
  for (let r = 2; r < rows.length; r++) {
    h += '<tr>' + cells(rows[r]).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
  }
  return h + '</tbody></table>';
}

/** Rende un blocco di righe in HTML. Ricorsiva (citazioni, item di lista). */
function renderBlocks(lines) {
  let html = '';
  let i = 0;
  let para = [];
  const flush = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t.startsWith('```')) {
      flush();
      i++;
      const buf = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++; }
      i++;
      html += `<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`;
      continue;
    }
    if (t === '') { flush(); i++; continue; }
    if (/^---+$/.test(t)) { flush(); html += '<hr>'; i++; continue; }

    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); const n = h[1].length; html += `<h${n} id="${slug(h[2])}">${inline(h[2])}</h${n}>`; i++; continue; }

    if (t.startsWith('>')) {
      flush();
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      html += `<blockquote>${renderBlocks(buf)}</blockquote>`;
      continue;
    }

    if (t.startsWith('|') && i + 1 < lines.length && /-/.test(lines[i + 1]) && /^\|?[\s:|-]+$/.test(lines[i + 1].trim())) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++; }
      html += renderTable(rows);
      continue;
    }

    const lm = itemMatch(line);
    if (lm) {
      flush();
      const ordered = /\d/.test(lm[2]);
      const baseIndent = lm[1].length;
      let out = ordered ? '<ol>' : '<ul>';
      while (i < lines.length) {
        const m = itemMatch(lines[i]);
        if (!m || m[1].length !== baseIndent) break;
        const contentCol = m[1].length + m[2].length + m[3].length;
        const first = m[4];
        i++;
        const cont = [];
        while (i < lines.length) {
          const l = lines[i];
          if (l.trim() === '') {
            const nxt = lines[i + 1];
            if (nxt && nxt.trim() !== '' && leading(nxt) >= contentCol) { cont.push(''); i++; continue; }
            break;
          }
          const mm = itemMatch(l);
          if (mm && mm[1].length === baseIndent) break;
          if (leading(l) >= contentCol || l.trim().startsWith('```')) { cont.push(l.slice(Math.min(contentCol, leading(l)))); i++; continue; }
          break;
        }
        // item su una riga -> tight; con continuazione (testo a capo, codice,
        // json) -> rende il tutto come blocco, fondendo il testo spezzato.
        out += cont.length
          ? `<li>${renderBlocks([first, ...cont])}</li>`
          : `<li>${inline(first)}</li>`;
      }
      html += out + (ordered ? '</ol>' : '</ul>');
      continue;
    }

    para.push(t);
    i++;
  }
  flush();
  return html;
}

/**
 * Rende una stringa Markdown in HTML.
 * @param {string} md
 * @returns {string}
 */
export function renderMarkdown(md) {
  return renderBlocks(String(md).replace(/\r\n/g, '\n').split('\n'));
}
