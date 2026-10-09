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
 * 追加実装 v1.1／追加改修③：JSONの「AI案件現在地」を、案件キー（またはtaskId）で今週の「タスク」行と突き合わせ、
 * 当日取得の結果を「最新取得」（日時・結果・現在地）として記録する。取得結果が「確認済み」のときだけ「AI案件現在地」と
 * 「現在地確認日時」も更新する。変更は履歴に残す。AI現在地は「朝ブリーフ」シートには保存しない。
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
    sync.writes.forEach(function (w) { updateTask_(w.taskId, w.changes); });
    delete sync.writes;
    var res = getMorningBrief(brief.date);
    res.aiSync = sync;
    return res;
  });
}

/**
 * AI案件現在地の同期（追加実装 v1.1 §6、追加改修③）。
 * 突き合わせ：
 * - 案件キーがある項目は、今週の「タスク」行（削除済みを除く、種別AI案件）のうち案件キーが一致する1行（タスク名では突き合わせない）。
 *   taskId も書かれていて別の行を指す場合は、どちらも信用せず同期しない。
 * - 案件キーが無い項目は taskId で突き合わせる（v1.1）。手動追加のAI案件（案件キーなし）は対象外。
 * 記録する条件：取得日時がその朝ブリーフの日付（古い取得は記録しない）。
 * - すべての取得結果で「最新取得日時・最新取得結果・最新取得現在地」を記録する（未確認の事実として区別して表示するため）。
 * - 「確認済み」のときだけ「AI案件現在地」と「現在地確認日時」も更新する。要確認・不一致・取得失敗・チャット未確認は上書きしない。
 * - 値が前回と同じなら書き換えず、履歴も増やさない。
 * 返す値：synced（確認済みで現在地を更新）、recorded（未確認として記録。現在地は前回のまま）、unchanged、skipped。
 */
function planAiSync_(date, items) {
  var out = { synced: [], recorded: [], unchanged: [], skipped: [], writes: [] };
  if (!items || !items.length) return out;
  var week = mondayOfDate_(date);
  var weekTasks = getTasks(week);
  var seen = {}, manual = null;
  items.forEach(function (it) {
    var label = it.title || it.taskId || it.caseKey || '（名前なし）';
    var skip = function (reason) { out.skipped.push({ taskId: it.taskId, title: label, result: it.result, reason: reason }); };
    var t = null;
    if (it.caseKey) {
      var nk = caseKeyNorm_(it.caseKey);
      var hits = weekTasks.filter(function (x) { return x.kind === 'AI案件' && caseKeyNorm_(x.caseKey) === nk; });
      if (!hits.length) return skip('今週のAI案件に案件キーが一致する行がないため同期しない');
      if (hits.length > 1) return skip('案件キーが一致する行が複数あるため同期しない');
      t = hits[0];
      if (it.taskId && it.taskId !== t.taskId) return skip('案件キーとtaskIdが別の行を指しているため同期しない');
    } else {
      if (!it.taskId) return skip('案件キー・taskIdがないため同期しない');
      t = weekTasks.filter(function (x) { return x.taskId === it.taskId; })[0];
      if (!t) return skip('今週のタスクにtaskIdが一致しないため同期しない');
      if (t.kind !== 'AI案件') return skip('AI案件ではないため同期しない');
      if (!manual) manual = manualTaskIds_();
      if (manual[it.taskId] && !String(t.caseKey || '').trim()) return skip('手動追加のAI案件で、ローカルAI案件との安全なtaskId対応が成立していないため同期しない');
    }
    if (seen[t.taskId]) return skip('同じ案件が重複しているため2件目以降は同期しない');
    seen[t.taskId] = true;
    label = String(t.title);
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(it.at)) || String(it.at).slice(0, 10) !== date) return skip('取得日時が当日ではないため記録しない（' + (it.at || '取得日時なし') + '）');
    var at = String(it.at).slice(0, 16);
    var resultText = it.result + (it.result !== '確認済み' && it.note ? '：' + it.note : '');
    var changes = { aiLatestAt: at, aiLatestResult: resultText, aiLatestPosition: it.position };
    if (it.result === '確認済み') { changes.aiPosition = it.position; changes.aiConfirmedAt = at; }
    var diff = {};
    Object.keys(changes).forEach(function (k) { if (String(t[k] === undefined ? '' : t[k]) !== String(changes[k])) diff[k] = changes[k]; });
    if (!Object.keys(diff).length) { out.unchanged.push({ taskId: t.taskId, title: label, result: it.result }); return; }
    prepareUpdate_(t.taskId, diff);
    out.writes.push({ taskId: t.taskId, changes: diff });
    if (it.result === '確認済み') out.synced.push({ taskId: t.taskId, title: label, position: it.position, at: at, positionChanged: diff.aiPosition !== undefined });
    else out.recorded.push({ taskId: t.taskId, title: label, result: it.result, position: it.position, at: at, note: it.note });
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
          taskId: String(x.taskId || '').trim(), caseKey: String(x.caseKey || '').trim(), title: String(x.title || ''), result: String(x.result || ''),
          position: String(x.position || '').trim(), at: String(x.at || ''), note: String(x.note || '')
        };
        if (AI_RESULT_VALUES.indexOf(it.result) < 0) errors.push(n + '取得結果は ' + AI_RESULT_VALUES.join('／') + ' のいずれかです。');
        if (it.result === '確認済み' && !it.position) errors.push(n + '確認済みの場合は現在地が必要です。');
        if (it.result === '確認済み' && !/^\d{4}-\d{2}-\d{2}/.test(it.at)) errors.push(n + '確認済みの場合は取得日時（yyyy-MM-dd HH:mm）が必要です。');
        if (it.caseKey && !/TASK_CURRENT\.md$/i.test(it.caseKey)) errors.push(n + '案件キーは TASK_CURRENT.md の場所です：' + it.caseKey);
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
