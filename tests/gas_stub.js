// GAS の SpreadsheetApp 等をメモリ上で再現するテスト用スタブ
const fs = require('fs'), vm = require('vm'), path = require('path');
function makeSheet(name) {
  const s = { name, data: [], frozen: 0, maxRows: 1000, formats: {}, validations: {} };
  const ensure = (r, c) => { while (s.data.length < r) s.data.push([]); const row = s.data[r - 1]; while (row.length < c) row.push(''); };
  s.api = {
    getName: () => name,
    getLastRow: () => { for (let i = s.data.length; i > 0; i--) if (s.data[i - 1].some(v => v !== '')) return i; return 0; },
    getLastColumn: () => Math.max(0, ...s.data.map(r => { for (let i = r.length; i > 0; i--) if (r[i - 1] !== '') return i; return 0; })),
    getMaxRows: () => s.maxRows,
    setFrozenRows: n => { s.frozen = n; },
    deleteRow: r => { s.data.splice(r - 1, 1); },
    appendRow: row => { const r = s.api.getLastRow() + 1; ensure(r, row.length); s.data[r - 1] = row.slice(); },
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(((s.data[r - 1 + i] || [])[c - 1 + j]) ?? ''); out.push(row); } return out; },
      setValues: v => { v.forEach((row, i) => row.forEach((x, j) => { ensure(r + i, c + j); s.data[r - 1 + i][c - 1 + j] = x; })); },
      setValue: x => { ensure(r, c); s.data[r - 1][c - 1] = x; },
      setNumberFormat: f => { s.formats[c] = f; },
      setDataValidation: v => { s.validations[c] = v; }
    })
  };
  return s;
}
function load(opts = {}) {
  const sheets = {};
  (opts.existing || ['シート1']).forEach(n => { sheets[n] = makeSheet(n); });
  const ss = {
    getName: () => '週間タスクボード',
    getSheets: () => Object.values(sheets).map(x => x.api),
    getSheetByName: n => (sheets[n] ? sheets[n].api : null),
    insertSheet: n => { sheets[n] = makeSheet(n); return sheets[n].api; }
  };
  let uuid = 0;
  const ctx = {
    console, Date, JSON, Object, String, Number, Math, Error,
    SpreadsheetApp: {
      openById: id => { ctx.openedId = id; return ss; },
      newDataValidation: () => { const v = {}; const b = { requireValueInList: l => { v.list = l; return b; }, setAllowInvalid: a => { v.allowInvalid = a; return b; }, build: () => v }; return b; }
    },
    Utilities: {
      getUuid: () => '00000000-0000-0000-0000-' + String(++uuid).padStart(12, '0'),
      formatDate: (d, tz, f) => '2026-10-05 09:00:00'
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://example/exec' }) },
    HtmlService: {}
  };
  vm.createContext(ctx);
  const src = path.join(__dirname, '..', 'src');
  ['Config.js', 'Schema.js', 'Store.js', 'Code.js', 'Is00Test.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename: f }));
  ctx.__sheets = sheets;
  return ctx;
}
module.exports = { load };
