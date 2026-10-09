// GAS の SpreadsheetApp 等をメモリ上で再現するテスト用スタブ
const fs = require('fs'), vm = require('vm'), path = require('path');
// Sheets と同様に、日付らしい文字列は日付型へ自動変換して保存する
function conv(x) {
  if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(x)) return new Date((x.length === 10 ? x + 'T00:00:00' : x.replace(' ', 'T')) + '+09:00');
  return x;
}
function fmt(d, f) {
  const j = new Date(d.getTime() + 9 * 3600e3), p = n => String(n).padStart(2, '0');
  return f.replace('yyyy', j.getUTCFullYear()).replace('MM', p(j.getUTCMonth() + 1)).replace('dd', p(j.getUTCDate()))
    .replace('HH', p(j.getUTCHours())).replace('mm', p(j.getUTCMinutes())).replace('ss', p(j.getUTCSeconds()));
}
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
    appendRow: row => { const r = s.api.getLastRow() + 1; ensure(r, row.length); s.data[r - 1] = row.map(conv); },
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(((s.data[r - 1 + i] || [])[c - 1 + j]) ?? ''); out.push(row); } return out; },
      setValues: v => { v.forEach((row, i) => row.forEach((x, j) => { ensure(r + i, c + j); s.data[r - 1 + i][c - 1 + j] = conv(x); })); },
      setValue: x => { ensure(r, c); s.data[r - 1][c - 1] = conv(x); },
      setNumberFormat: f => { s.formats[c] = f; },
      setDataValidation: v => { s.validations[c] = v; },
      getDataValidation: () => (s.validations[c] ? { getCriteriaValues: () => [s.validations[c].list, true] } : null)
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
      formatDate: (d, tz, f) => fmt(d, f)
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://example/exec' }) },
    HtmlService: {}
  };
  vm.createContext(ctx);
  const src = path.join(__dirname, '..', 'src');
  ['Config.js', 'Schema.js', 'Store.js', 'Board.js', 'Brief.js', 'Code.js', 'Is00Test.js', 'Migration.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename: f }));
  ctx.__sheets = sheets;
  return ctx;
}
module.exports = { load };
