/**
 * IS-00 実データ試験（Apps Script エディタから runIs00SheetTest を実行する）
 * 1. setupSheets で「タスク」「履歴」を用意（既存データは変更しない）
 * 2. DB_SCHEMA と実シートの一致確認
 * 3. 状態5値・履歴の保存／再読込
 * 4. 試験で追加した行だけを削除し、試験前の行数に戻す
 */
var IS00_TEST_WEEK = '2000-01-03';

function runIs00SheetTest() {
  var result = { checks: [], ok: false };
  var check = function (name, ok, detail) {
    result.checks.push({ name: name, ok: !!ok, detail: detail === undefined ? '' : detail });
    if (!ok) throw new Error('試験失敗：' + name + ' ' + JSON.stringify(detail));
  };
  var ss = openSpreadsheet_();
  result.spreadsheet = ss.getName();
  result.sheetsBefore = ss.getSheets().map(function (s) { return s.getName(); });
  var taskId = null;
  var before = {};
  try {
    check('対象スプレッドシート', ss.getName() === '週間タスクボード', ss.getName());
    var setup = setupSheets();
    result.created = setup.created;
    check('DB_SCHEMA一致', setup.schema.every(function (s) { return s.ok; }), setup.schema);
    before.tasks = tasksSheet_().getLastRow();
    before.history = historySheet_().getLastRow();

    var task = createTask({ targetWeek: IS00_TEST_WEEK, title: '[IS-00試験] 削除予定', kind: '通常タスク' });
    taskId = task.taskId;
    STATUS_VALUES.forEach(function (s) {
      updateTask(taskId, { status: s });
      var reloaded = getTasks(IS00_TEST_WEEK).filter(function (t) { return t.taskId === taskId; })[0];
      check('状態保存・再読込：' + s, reloaded && reloaded.status === s, reloaded && reloaded.status);
    });
    updateTask(taskId, { memo: 'IS-00試験メモ' });

    var ops = getHistory(taskId).map(function (h) { return h.op + (h.field ? ':' + h.field : '') + (h.after !== '' ? '=' + h.after : ''); });
    var expected = ['作成', '状態変更:状態=進行中', '状態変更:状態=完了', '状態変更:状態=次週候補', '状態変更:状態=持越し', '修正:メモ=IS-00試験メモ'];
    check('履歴保存・再読込', ops.join('|') === expected.join('|'), ops);
    result.ok = true;
  } catch (e) {
    result.error = e.message;
  } finally {
    if (taskId) {
      result.cleanup = {
        tasks: deleteRowsByTaskId_(tasksSheet_(), 1, taskId),
        history: deleteRowsByTaskId_(historySheet_(), 2, taskId)
      };
      result.restored = tasksSheet_().getLastRow() === before.tasks && historySheet_().getLastRow() === before.history;
      if (!result.restored) result.ok = false;
    }
    result.sheetsAfter = ss.getSheets().map(function (s) { return s.getName(); });
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// 試験データ削除専用：指定タスクIDの行だけを下から削除する
function deleteRowsByTaskId_(sheet, col, taskId) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var ids = sheet.getRange(2, col, last - 1, 1).getValues();
  var n = 0;
  for (var i = ids.length - 1; i >= 0; i--) {
    if (ids[i][0] === taskId) { sheet.deleteRow(i + 2); n++; }
  }
  return n;
}
