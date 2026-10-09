/**
 * 正データ読み書き（IS-00：状態（6値。追加改修で「保留」を追加）と履歴の保存／再読込）
 * 既存データは上書き・削除しない。変更は必ず履歴シートへ記録する。
 */

function openSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * シートを用意する。無ければ作成、空なら見出しを書く。
 * 既存の見出しが定義と異なる場合は上書きせずエラーにする。
 */
function setupSheets() {
  var ss = openSpreadsheet_();
  var created = [];
  ALL_SHEETS.forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      created.push(def.name);
    }
    if (sheet.getLastRow() === 0) {
      writeHeader_(sheet, def);
    } else {
      if (def === SHEETS.TASKS) upgradeTasksHeader_(sheet);
      assertHeader_(sheet, def);
      if (def === SHEETS.TASKS) upgradeDayValidation_(sheet);
      if (def === SHEETS.TASKS) upgradeStatusValidation_(sheet);
      if (def === SHEETS.HISTORY) upgradeHistoryOps_(sheet);
    }
  });
  return { created: created, schema: checkSchema() };
}

function writeHeader_(sheet, def) {
  var headers = headersOf_(def);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  def.columns.forEach(function (c, i) {
    var col = sheet.getRange(2, i + 1, sheet.getMaxRows() - 1, 1);
    if (c.text) col.setNumberFormat('@');
    if (c.values) {
      col.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(c.values, true).setAllowInvalid(false).build());
    }
  });
}

// 既存の「タスク」シートに、後から追加した列の見出しを末尾に足す（既存の列・行は変更しない）
// IS-04：13列→「持越し元タスクID」（14列目）、IS-06：14列→「削除済み」（15列目）
function upgradeTasksHeader_(sheet) {
  var def = SHEETS.TASKS;
  var headers = headersOf_(def);
  var last = sheet.getLastColumn();
  if (last < 13 || last >= headers.length) return;
  var actual = sheet.getRange(1, 1, 1, last).getValues()[0];
  if (actual.join('\t') !== headers.slice(0, last).join('\t')) return;
  // 足りない見出しセル（1行目）だけを書く。既存セルの値・書式には触れない
  sheet.getRange(1, last + 1, 1, headers.length - last).setValues([headers.slice(last)]);
}

// 追加実装 v1.1：「タスク」シートの「曜日」列の入力規則を、複数曜日の値を保存できる一覧に更新する（規則の選択肢だけを更新。値・行は変更しない）
function upgradeDayValidation_(sheet) {
  var col = SHEETS.TASKS.columns.map(function (c) { return c.key; }).indexOf('day') + 1;
  if (sheet.getMaxRows() < 2) return;
  var rule = sheet.getRange(2, col).getDataValidation();
  if (!rule) return;
  var values = rule.getCriteriaValues()[0] || [];
  if (values.indexOf('月' + DAY_SEPARATOR + '火') >= 0) return;
  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(DAY_COMBOS, true).setAllowInvalid(false).build());
}

// 追加改修（保留）：「タスク」シートの「状態」列の入力規則に「保留」が無ければ、6値の一覧に更新する（規則の選択肢だけを更新。値・行は変更しない）
function upgradeStatusValidation_(sheet) {
  var col = SHEETS.TASKS.columns.map(function (c) { return c.key; }).indexOf('status') + 1;
  if (sheet.getMaxRows() < 2) return;
  var rule = sheet.getRange(2, col).getDataValidation();
  if (!rule) return;
  var values = rule.getCriteriaValues()[0] || [];
  if (values.indexOf('保留') >= 0) return;
  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_VALUES, true).setAllowInvalid(false).build());
}

/**
 * 曜日の正規化（追加実装 v1.1）：配列・「,」「、」「・」区切りの文字列を受け取り、月→金の固定順・重複なしの文字列にする。
 * 月〜金以外の値はそのまま残し、検証でエラーにする（推測で捨てない）。
 */
function normalizeDays_(v) {
  if (v === undefined || v === null) return '';
  var parts = Array.isArray(v) ? v : String(v).split(/[,、・\s]+/);
  var seen = {}, valid = [], bad = [];
  parts.forEach(function (p) {
    p = String(p).trim();
    if (!p || seen[p]) return;
    seen[p] = true;
    if (DAY_VALUES.indexOf(p) >= 0) valid.push(p); else bad.push(p);
  });
  valid.sort(function (a, b) { return DAY_VALUES.indexOf(a) - DAY_VALUES.indexOf(b); });
  return valid.concat(bad).join(DAY_SEPARATOR);
}

/** 曜日の値（保存形式）を配列にする。空欄＝[]（未配置） */
function daysOf_(v) {
  var s = String(v || '');
  return s ? s.split(DAY_SEPARATOR) : [];
}

// IS-06：「履歴」シートの「操作」列の入力規則に「削除」が無ければ足す（規則の選択肢だけを更新。値・行は変更しない）
function upgradeHistoryOps_(sheet) {
  var col = SHEETS.HISTORY.columns.map(function (c) { return c.key; }).indexOf('op') + 1;
  if (sheet.getMaxRows() < 2) return;
  var rule = sheet.getRange(2, col).getDataValidation();
  if (!rule) return;
  var values = rule.getCriteriaValues()[0] || [];
  if (values.indexOf('削除') >= 0) return;
  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(HISTORY_OPS, true).setAllowInvalid(false).build());
}

function assertHeader_(sheet, def) {
  var expected = headersOf_(def);
  var actual = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (actual.join('\t') !== expected.join('\t')) {
    throw new Error('シート「' + def.name + '」の見出しがDB_SCHEMAと一致しません：' + actual.join(','));
  }
}

/** Sheets実表とDB_SCHEMAの一致確認 */
function checkSchema() {
  var ss = openSpreadsheet_();
  return ALL_SHEETS.map(function (def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) return { sheet: def.name, ok: false, problem: 'シートなし' };
    try {
      assertHeader_(sheet, def);
      return { sheet: def.name, ok: true };
    } catch (e) {
      return { sheet: def.name, ok: false, problem: e.message };
    }
  });
}

function tasksSheet_() {
  var sheet = openSpreadsheet_().getSheetByName(SHEETS.TASKS.name);
  if (!sheet) throw new Error('シート「' + SHEETS.TASKS.name + '」がありません。setupSheets を実行してください。');
  upgradeTasksHeader_(sheet);
  assertHeader_(sheet, SHEETS.TASKS);
  return sheet;
}

function historySheet_() {
  var sheet = openSpreadsheet_().getSheetByName(SHEETS.HISTORY.name);
  if (!sheet) throw new Error('シート「' + SHEETS.HISTORY.name + '」がありません。setupSheets を実行してください。');
  assertHeader_(sheet, SHEETS.HISTORY);
  return sheet;
}

// Sheets が日付文字列を日付型へ自動変換した場合も、定義どおりの文字列に戻して読む
function rowToObj_(def, row) {
  var obj = {};
  def.columns.forEach(function (c, i) {
    var v = row[i];
    if (c.dateFormat && Object.prototype.toString.call(v) === '[object Date]') {
      v = Utilities.formatDate(v, CONFIG.TIME_ZONE, c.dateFormat);
    }
    obj[c.key] = v;
  });
  return obj;
}

// 最終行の次へ1行追加する
function appendObj_(sheet, def, obj) {
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, def.columns.length).setValues([objToRow_(def, obj)]);
}

function objToRow_(def, obj) {
  return def.columns.map(function (c) { return obj[c.key] === undefined ? '' : obj[c.key]; });
}

function readAll_(sheet, def) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, def.columns.length).getValues()
    .map(function (row) { return rowToObj_(def, row); });
}

/** タスク一覧（対象週を指定すると絞り込み）。削除済みのタスクは含めない（IS-06） */
function getTasks(targetWeek) {
  return getTasksIncludingDeleted_(targetWeek).filter(function (t) { return t.deleted !== true; });
}

// 削除済みも含めた全行（持越しの二重取り込み防止など、内部の照合だけで使う）
function getTasksIncludingDeleted_(targetWeek) {
  var tasks = readAll_(tasksSheet_(), SHEETS.TASKS).map(function (t) {
    t.deleted = t.deleted === true || t.deleted === 'TRUE' ? true : '';
    return t;
  });
  return targetWeek ? tasks.filter(function (t) { return t.targetWeek === targetWeek; }) : tasks;
}

/**
 * タスクを削除済みにする（IS-06）。行は消さず「削除済み」列に TRUE を入れ、履歴に「削除」を記録する。
 * 対象週のタスクで、まだ削除済みでないものだけ。
 */
function markTaskDeleted_(targetWeek, taskId) {
  var sheet = tasksSheet_();
  var def = SHEETS.TASKS;
  var last = sheet.getLastRow();
  var ids = last < 2 ? [] : sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return r[0]; });
  var idx = ids.indexOf(taskId);
  if (idx < 0) throw new Error('タスクが見つかりません：' + taskId);
  var rowNo = idx + 2;
  var current = rowToObj_(def, sheet.getRange(rowNo, 1, 1, def.columns.length).getValues()[0]);
  if (current.targetWeek !== targetWeek) throw new Error('対象週のタスクではありません：' + taskId);
  if (current.deleted === true || current.deleted === 'TRUE') throw new Error('すでに削除済みです：' + current.title);
  var col = def.columns.map(function (c) { return c.key; }).indexOf('deleted') + 1;
  sheet.getRange(rowNo, col).setValue(true);
  var hs = historySheet_();
  upgradeHistoryOps_(hs);
  appendHistory_([{ taskId: taskId, op: '削除', field: '削除済み', before: '', after: 'TRUE' }]);
  return current;
}

/** 履歴一覧（タスクIDを指定すると絞り込み） */
function getHistory(taskId) {
  var rows = readAll_(historySheet_(), SHEETS.HISTORY);
  return taskId ? rows.filter(function (h) { return h.taskId === taskId; }) : rows;
}

/** タスク作成：IDを採番し、履歴「作成」を記録する */
function createTask(input) {
  return withLock_(function () { return createTask_(input); });
}

/** タスク更新：変更項目ごとに履歴を記録する（状態は「状態変更」、他は「修正」） */
function updateTask(taskId, changes) {
  return withLock_(function () { return updateTask_(taskId, changes); });
}

// 作成の本体（ロックは呼び出し側で取得する）。historyField：履歴「作成」の項目（v1.2：手動追加は「手動追加」、それ以外は空欄）
function createTask_(input, historyField) {
  var task = prepareCreate_(input);
  var sheet = tasksSheet_();
  if (task.day.indexOf(DAY_SEPARATOR) >= 0) upgradeDayValidation_(sheet);
  if (task.status === '保留') upgradeStatusValidation_(sheet);
  appendObj_(sheet, SHEETS.TASKS, task);
  appendHistory_([{ taskId: task.taskId, op: '作成', field: historyField || '', before: '', after: '' }]);
  return task;
}

// 作成内容の正規化・検証・ID採番（書き込みはしない）
function prepareCreate_(input) {
  var task = normalizeTask_(Object.assign({ status: '未着手', focus: false }, input));
  task.taskId = 'T-' + Utilities.getUuid();
  validateTask_(task);
  return task;
}

// 更新の本体（ロックは呼び出し側で取得する）
function updateTask_(taskId, changes) {
  var plan = prepareUpdate_(taskId, changes);
  var sheet = tasksSheet_();
  if (String(plan.next.day).indexOf(DAY_SEPARATOR) >= 0 && plan.next.day !== plan.current.day) upgradeDayValidation_(sheet);
  if (plan.next.status === '保留' && plan.current.status !== '保留') upgradeStatusValidation_(sheet);
  var history = [];
  SHEETS.TASKS.columns.forEach(function (c, i) {
    if (String(plan.current[c.key]) === String(plan.next[c.key])) return;
    sheet.getRange(plan.rowNo, i + 1).setValue(plan.next[c.key]);
    history.push({
      taskId: taskId,
      op: c.key === 'status' ? '状態変更' : '修正',
      field: c.header,
      before: plan.current[c.key],
      after: plan.next[c.key]
    });
  });
  if (history.length) appendHistory_(history);
  return plan.next;
}

// 更新内容の正規化・検証（書き込みはしない）
function prepareUpdate_(taskId, changes) {
  if (changes.taskId !== undefined && changes.taskId !== taskId) throw new Error('タスクIDは変更できません。');
  var sheet = tasksSheet_();
  var def = SHEETS.TASKS;
  var last = sheet.getLastRow();
  var ids = last < 2 ? [] : sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return r[0]; });
  var idx = ids.indexOf(taskId);
  if (idx < 0) throw new Error('タスクが見つかりません：' + taskId);
  var rowNo = idx + 2;
  var current = normalizeTask_(rowToObj_(def, sheet.getRange(rowNo, 1, 1, def.columns.length).getValues()[0]));
  if (current.deleted === true) throw new Error('削除済みのタスクは変更できません：' + current.title);
  var next = normalizeTask_(Object.assign({}, current, changes));
  validateTask_(next);
  return { rowNo: rowNo, current: current, next: next };
}

function appendHistory_(entries) {
  var sheet = historySheet_();
  var at = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
  entries.forEach(function (h) {
    appendObj_(sheet, SHEETS.HISTORY, Object.assign({ at: at }, h));
  });
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function normalizeTask_(t) {
  var out = Object.assign({}, t);
  out.focus = out.focus === true || out.focus === 'TRUE';
  if (out.priority === undefined || out.priority === null) out.priority = '';
  ['day', 'result', 'memo', 'handover', 'exception', 'aiPosition', 'sourceTaskId'].forEach(function (k) {
    if (out[k] === undefined || out[k] === null) out[k] = '';
  });
  out.day = normalizeDays_(out.day);
  // 削除済み：TRUE のときだけ true、それ以外は空欄（既存行の空欄と同じ扱いにし、余計な履歴を作らない）
  out.deleted = out.deleted === true || out.deleted === 'TRUE' ? true : '';
  return out;
}

function validateTask_(t) {
  var errors = [];
  if (!t.title) errors.push('タスク名／案件名は必須です。');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.targetWeek)) || !isMonday_(t.targetWeek)) {
    errors.push('対象週はその週の月曜日を yyyy-MM-dd で指定してください：' + t.targetWeek);
  }
  if (KIND_VALUES.indexOf(t.kind) < 0) errors.push('種別が不正です：' + t.kind);
  if (t.day !== '' && DAY_COMBOS.indexOf(t.day) < 0) errors.push('曜日は月〜金（複数可、重複なし）で指定してください：' + t.day);
  if (STATUS_VALUES.indexOf(t.status) < 0) errors.push('状態が不正です：' + t.status);
  if (t.priority !== '' && !(Number(t.priority) >= 1 && Number(t.priority) % 1 === 0)) {
    errors.push('優先度は1以上の整数で指定してください：' + t.priority);
  }
  if (t.exception !== '' && !EXCEPTION_TYPES.some(function (e) { return String(t.exception).indexOf(e + '：') === 0; })) {
    errors.push('例外情報は「区分：内容」で、区分は ' + EXCEPTION_TYPES.join('／') + ' のいずれかです：' + t.exception);
  }
  if (t.aiPosition !== '' && t.kind !== 'AI案件') errors.push('AI案件現在地は種別がAI案件の場合だけ設定できます。');
  if (errors.length) throw new Error(errors.join('\n'));
}

function isMonday_(ymd) {
  var p = String(ymd).split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDay() === 1;
}
