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

/**
 * 朝ブリーフを保存する。シートが無ければ作成する（既存シートは変更しない）。
 * 追加実装 v1.1：JSONの「AI案件現在地」のうち、取得結果が「確認済み」で、taskId が今週の「タスク」行と一致するものだけを
 * その行の「AI案件現在地」へ同期し、履歴（修正／AI案件現在地）を残す。AI現在地は「朝ブリーフ」シートには保存しない。
 */
function saveMorningBrief(input) {
  var brief = normalizeBrief_(input);
  return withLock_(function () {
    // 同期内容を先に決めて検証する（検証に失敗したら朝ブリーフも書かない）
    var sync = planAiSync_(brief.date, brief.aiPositions);
    var sheet = briefSheet_();
    var row = { date: brief.date, savedAt: Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'), oneLine: brief.oneLine };
    BRIEF_LIST_KEYS.forEach(function (k) { row[k] = brief[k].join('\n'); });
    appendObj_(sheet, SHEETS.BRIEF, row);
    sync.synced.forEach(function (x) { updateTask_(x.taskId, { aiPosition: x.position }); });
    var res = getMorningBrief(brief.date);
    res.aiSync = sync;
    return res;
  });
}

/**
 * AI案件現在地の同期（追加実装 v1.1 §6）。同期するのは次をすべて満たすものだけ。
 * - 取得結果が「確認済み」（要確認・不一致・取得失敗・チャット未確認は上書きしない）
 * - taskId があり、朝ブリーフの日付の週の「タスク」行（削除済みを除く、種別AI案件）と一致する（タスク名では突き合わせない）
 * - 取得日時がその朝ブリーフの日付（古い日付の取得は当日取得として扱わない）
 * - 現在地が前回値と異なる（同じなら書き換えず、履歴も増やさない）
 */
function planAiSync_(date, items) {
  var out = { synced: [], unchanged: [], skipped: [] };
  if (!items || !items.length) return out;
  var week = mondayOfDate_(date);
  var weekTasks = getTasks(week);
  var seen = {};
  items.forEach(function (it) {
    var label = it.title || it.taskId || '（名前なし）';
    if (it.result !== '確認済み') { out.skipped.push({ taskId: it.taskId, title: label, reason: it.result + 'のため更新しない' }); return; }
    if (!it.taskId) { out.skipped.push({ taskId: '', title: label, reason: 'taskIdがないため同期しない' }); return; }
    if (seen[it.taskId]) { out.skipped.push({ taskId: it.taskId, title: label, reason: '同じtaskIdが重複しているため2件目以降は同期しない' }); return; }
    seen[it.taskId] = true;
    var t = weekTasks.filter(function (x) { return x.taskId === it.taskId; })[0];
    if (!t) { out.skipped.push({ taskId: it.taskId, title: label, reason: '今週のタスクにtaskIdが一致しないため同期しない' }); return; }
    if (t.kind !== 'AI案件') { out.skipped.push({ taskId: it.taskId, title: label, reason: 'AI案件ではないため同期しない' }); return; }
    if (String(it.at).slice(0, 10) !== date) { out.skipped.push({ taskId: it.taskId, title: label, reason: '取得日時が当日ではないため同期しない' }); return; }
    if (String(t.aiPosition) === it.position) { out.unchanged.push({ taskId: it.taskId, title: String(t.title) }); return; }
    prepareUpdate_(it.taskId, { aiPosition: it.position });
    out.synced.push({ taskId: it.taskId, title: String(t.title), position: it.position });
  });
  return out;
}

// 日付（yyyy-MM-dd）が属する週の月曜日
function mondayOfDate_(ymd) {
  var p = String(ymd).split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
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
  // AI案件現在地（任意。追加実装 v1.1）
  out.aiPositions = [];
  if (input.aiPositions !== undefined && input.aiPositions !== null) {
    if (!Array.isArray(input.aiPositions)) {
      errors.push('aiPositions は配列で指定してください。');
    } else {
      input.aiPositions.forEach(function (x, i) {
        var n = 'AI案件現在地 ' + (i + 1) + '件目：';
        if (!x || typeof x !== 'object') { errors.push(n + '形式が不正です。'); return; }
        var it = {
          taskId: String(x.taskId || '').trim(), title: String(x.title || ''), result: String(x.result || ''),
          position: String(x.position || '').trim(), at: String(x.at || ''), note: String(x.note || '')
        };
        if (AI_RESULT_VALUES.indexOf(it.result) < 0) errors.push(n + '取得結果は ' + AI_RESULT_VALUES.join('／') + ' のいずれかです。');
        if (it.result === '確認済み' && !it.position) errors.push(n + '確認済みの場合は現在地が必要です。');
        if (it.result === '確認済み' && !/^\d{4}-\d{2}-\d{2}/.test(it.at)) errors.push(n + '確認済みの場合は取得日時（yyyy-MM-dd HH:mm）が必要です。');
        out.aiPositions.push(it);
      });
    }
  }
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
