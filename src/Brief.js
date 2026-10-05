/**
 * 朝ブリーフのサーバー処理（IS-03）
 * ChatGPT Project が作った朝ブリーフ（docs/BRIEF_FORMAT.md）を「朝ブリーフ」シートへ追記保存し、日付ごとに最新を返す。
 * 同じ日付で再保存した場合も既存行は上書きせず、新しい行を追加する（表示は最新行）。
 */
var BRIEF_LIST_KEYS = ['flow', 'priorities', 'concerns', 'done', 'carryover'];

/** 指定日（省略時は今日）の朝ブリーフ。無ければ brief は null */
function getMorningBrief(date) {
  var d = date || currentDate_();
  assertDate_(d);
  var sheet = openSpreadsheet_().getSheetByName(SHEETS.BRIEF.name);
  var brief = null;
  if (sheet) {
    assertHeader_(sheet, SHEETS.BRIEF);
    readAll_(sheet, SHEETS.BRIEF).forEach(function (row) {
      if (row.date === d) brief = rowToBrief_(row);
    });
  }
  return { date: d, today: currentDate_(), brief: brief, loadedAt: nowText_() };
}

/** 朝ブリーフを保存する。シートが無ければ作成する（既存シートは変更しない） */
function saveMorningBrief(input) {
  var brief = normalizeBrief_(input);
  return withLock_(function () {
    var sheet = briefSheet_();
    var row = { date: brief.date, savedAt: Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'), oneLine: brief.oneLine };
    BRIEF_LIST_KEYS.forEach(function (k) { row[k] = brief[k].join('\n'); });
    appendObj_(sheet, SHEETS.BRIEF, row);
    return getMorningBrief(brief.date);
  });
}

function briefSheet_() {
  var ss = openSpreadsheet_();
  var sheet = ss.getSheetByName(SHEETS.BRIEF.name);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.BRIEF.name);
    writeHeader_(sheet, SHEETS.BRIEF);
  } else if (sheet.getLastRow() === 0) {
    writeHeader_(sheet, SHEETS.BRIEF);
  } else {
    assertHeader_(sheet, SHEETS.BRIEF);
  }
  return sheet;
}

function rowToBrief_(row) {
  var b = { date: row.date, savedAt: row.savedAt, oneLine: String(row.oneLine) };
  BRIEF_LIST_KEYS.forEach(function (k) {
    b[k] = String(row[k]) === '' ? [] : String(row[k]).split('\n');
  });
  return b;
}

// 画面から受け取った朝ブリーフの検証（キーは画面側で docs/BRIEF_FORMAT.md から変換済み）
function normalizeBrief_(input) {
  input = input || {};
  var errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ''))) errors.push('日付は yyyy-MM-dd で指定してください。');
  if (typeof input.oneLine !== 'string' || !input.oneLine.trim()) errors.push('今日の一言は必須です。');
  var out = { date: String(input.date || ''), oneLine: String(input.oneLine || '') };
  BRIEF_LIST_KEYS.forEach(function (k) {
    var v = input[k];
    if (!Array.isArray(v) || v.some(function (x) { return typeof x !== 'string'; })) {
      errors.push(k + ' は文字列の配列で指定してください。');
      out[k] = [];
    } else {
      out[k] = v.map(function (x) { return x.replace(/\r?\n/g, ' ').trim(); }).filter(function (x) { return x !== ''; });
    }
  });
  if (errors.length) throw new Error(errors.join('\n'));
  return out;
}

// 今日（Asia/Tokyo）yyyy-MM-dd
function currentDate_() {
  return Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd');
}

function assertDate_(d) {
  var p = String(d).split('-').map(Number);
  var x = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d)) || x.getUTCFullYear() !== p[0] || x.getUTCMonth() !== p[1] - 1 || x.getUTCDate() !== p[2]) {
    throw new Error('日付は yyyy-MM-dd で指定してください：' + d);
  }
}
