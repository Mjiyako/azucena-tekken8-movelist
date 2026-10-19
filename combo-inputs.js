(function (root) {
  const directions = new Set(['f', 'b', 'd', 'u', 'df', 'db', 'uf', 'ub', 'n']);
  const motions = { qcf: ['d', 'df', 'f'], qcb: ['d', 'db', 'b'],
    hcf: ['b', 'db', 'd', 'df', 'f'], hcb: ['f', 'df', 'd', 'db', 'b'] };
  function parse(notation) {
    const source = String(notation).replace(/\b([dDuU])\/([fFbB])\b/g, '$1$2')
      .replace(/\b(i?ws|i?wr|qcf|qcb|hcf|hcb|df|db|uf|ub|[fbdun])([1-4]+)\b/gi, '$1 $2');
    const raw = source.match(/[1-4](?:\+[1-4])*|[A-Za-z][A-Za-z0-9!'’_-]*|\s+|[^\s]/g) || [];
    const tokens = [];
    for (const part of raw) {
      if (/^\s+$/.test(part)) continue;
      const lower = part.toLowerCase();
      if (directions.has(lower)) tokens.push({ kind: 'direction', raw: part, held: /^[UDFB]{1,2}$/.test(part) });
      else if (motions[lower]) tokens.push(...motions[lower].map(raw => ({ kind: 'direction', raw, held: false })));
      else if (/^[1-4](?:\+[1-4])*$/.test(part)) tokens.push({ kind: 'buttons', buttons: part.split('+'), held: false });
      else if (part === '*') {
        const previous = tokens.at(-1);
        if (previous && ['direction', 'buttons'].includes(previous.kind)) previous.held = true;
        else tokens.push({ kind: 'text', text: part });
      } else if (['►', '→'].includes(part)) tokens.push({ kind: 'separator', text: '→', major: true });
      else if (['~', ':', '>'].includes(part)) tokens.push({ kind: 'timing', text: { '~': 'FAST', ':': 'JUST', '>': 'DELAY' }[part] });
      else if ([',', '.', '+'].includes(part)) tokens.push({ kind: 'separator', text: part, major: false });
      else {
        const previous = tokens.at(-1);
        if (previous?.kind === 'text' && /^[A-Za-z]/.test(part) && /[A-Za-z]$/.test(previous.text)) previous.text += ' ' + part;
        else tokens.push({ kind: 'text', text: part });
      }
    }
    return tokens;
  }
  root.TekkenComboInputs = { parse };
  if (typeof module !== 'undefined') module.exports = { parse };
})(globalThis);
