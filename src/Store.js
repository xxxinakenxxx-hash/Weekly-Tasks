/**
 * 正データ読み書き（IS-00：状態5値と履歴の保存／再読込）
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
  [SHEETS.TASKS, SHEETS.HISTORY].forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      created.push(def.name);
    }
    if (sheet.getLastRow() === 0) {
      writeHeader_(sheet, def);
    } else {
      assertHeader_(sheet, def);
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
  return [SHEETS.TASKS, SHEETS.HISTORY].map(function (def) {
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

/** タスク一覧（対象週を指定すると絞り込み） */
function getTasks(targetWeek) {
  var tasks = readAll_(tasksSheet_(), SHEETS.TASKS);
  return targetWeek ? tasks.filter(function (t) { return t.targetWeek === targetWeek; }) : tasks;
}

/** 履歴一覧（タスクIDを指定すると絞り込み） */
function getHistory(taskId) {
  var rows = readAll_(historySheet_(), SHEETS.HISTORY);
  return taskId ? rows.filter(function (h) { return h.taskId === taskId; }) : rows;
}

/** タスク作成：IDを採番し、履歴「作成」を記録する */
function createTask(input) {
  return withLock_(function () {
    var task = normalizeTask_(Object.assign({ status: '未着手', focus: false }, input));
    task.taskId = 'T-' + Utilities.getUuid();
    validateTask_(task);
    var sheet = tasksSheet_();
    appendObj_(sheet, SHEETS.TASKS, task);
    appendHistory_([{ taskId: task.taskId, op: '作成', field: '', before: '', after: '' }]);
    return task;
  });
}

/** タスク更新：変更項目ごとに履歴を記録する（状態は「状態変更」、他は「修正」） */
function updateTask(taskId, changes) {
  return withLock_(function () {
    if (changes.taskId !== undefined && changes.taskId !== taskId) throw new Error('タスクIDは変更できません。');
    var sheet = tasksSheet_();
    var def = SHEETS.TASKS;
    var last = sheet.getLastRow();
    var ids = last < 2 ? [] : sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return r[0]; });
    var idx = ids.indexOf(taskId);
    if (idx < 0) throw new Error('タスクが見つかりません：' + taskId);
    var rowNo = idx + 2;
    var current = rowToObj_(def, sheet.getRange(rowNo, 1, 1, def.columns.length).getValues()[0]);
    var next = normalizeTask_(Object.assign({}, current, changes));
    validateTask_(next);

    var history = [];
    def.columns.forEach(function (c, i) {
      if (String(current[c.key]) === String(next[c.key])) return;
      sheet.getRange(rowNo, i + 1).setValue(next[c.key]);
      history.push({
        taskId: taskId,
        op: c.key === 'status' ? '状態変更' : '修正',
        field: c.header,
        before: current[c.key],
        after: next[c.key]
      });
    });
    if (history.length) appendHistory_(history);
    return next;
  });
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
  ['day', 'result', 'memo', 'handover', 'exception', 'aiPosition'].forEach(function (k) {
    if (out[k] === undefined || out[k] === null) out[k] = '';
  });
  return out;
}

function validateTask_(t) {
  var errors = [];
  if (!t.title) errors.push('タスク名／案件名は必須です。');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.targetWeek)) || !isMonday_(t.targetWeek)) {
    errors.push('対象週はその週の月曜日を yyyy-MM-dd で指定してください：' + t.targetWeek);
  }
  if (KIND_VALUES.indexOf(t.kind) < 0) errors.push('種別が不正です：' + t.kind);
  if (t.day !== '' && DAY_VALUES.indexOf(t.day) < 0) errors.push('曜日が不正です：' + t.day);
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
