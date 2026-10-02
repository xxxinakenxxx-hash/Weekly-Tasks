/**
 * 週間タスク画面のサーバー処理（IS-01）
 * 表示：対象週の正データを返す。確定：候補の採用と既存タスクの変更を1回でまとめて保存する。
 */

// 週間画面で変更できる項目（実施結果・メモ・次回申し送りの更新はIS-04）
var BOARD_EDITABLE_KEYS = ['title', 'day', 'priority', 'focus', 'status'];
// 候補の採用時に保存する項目
var BOARD_CREATE_KEYS = ['title', 'kind', 'day', 'priority', 'focus', 'status', 'exception'];

/** 対象週の週間ボード（対象週省略時は今週） */
function getWeekBoard(targetWeek) {
  var week = targetWeek || currentWeek_();
  assertWeek_(week);
  return { targetWeek: week, tasks: getTasks(week) };
}

/**
 * 週間ボードの確定。
 * payload.creates：採用する候補の配列。payload.updates：[{ taskId, changes }] の配列。
 * すべて検証してから書き込む（途中で失敗したら1件も書かない）。
 */
function commitWeekBoard(targetWeek, payload) {
  assertWeek_(targetWeek);
  payload = payload || {};
  var creates = payload.creates || [];
  var updates = payload.updates || [];
  if (!creates.length && !updates.length) throw new Error('確定する変更がありません。');
  return withLock_(function () {
    var weekIds = getTasks(targetWeek).map(function (t) { return t.taskId; });
    var errors = [];
    creates.forEach(function (c, i) {
      try {
        prepareCreate_(Object.assign(pick_(c, BOARD_CREATE_KEYS), { targetWeek: targetWeek }));
      } catch (e) {
        errors.push('追加' + (i + 1) + '件目「' + (c.title || '') + '」：' + e.message);
      }
    });
    updates.forEach(function (u) {
      try {
        if (weekIds.indexOf(u.taskId) < 0) throw new Error('対象週のタスクではありません。');
        prepareUpdate_(u.taskId, pick_(u.changes || {}, BOARD_EDITABLE_KEYS));
      } catch (e) {
        errors.push('変更「' + u.taskId + '」：' + e.message);
      }
    });
    if (errors.length) throw new Error(errors.join('\n'));

    creates.forEach(function (c) {
      createTask_(Object.assign(pick_(c, BOARD_CREATE_KEYS), { targetWeek: targetWeek }));
    });
    updates.forEach(function (u) {
      updateTask_(u.taskId, pick_(u.changes || {}, BOARD_EDITABLE_KEYS));
    });
    return { targetWeek: targetWeek, tasks: getTasks(targetWeek), created: creates.length, updated: updates.length };
  });
}

// 今週（Asia/Tokyo）の月曜日 yyyy-MM-dd
function currentWeek_() {
  var p = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd').split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function assertWeek_(week) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(week)) || !isMonday_(week)) {
    throw new Error('対象週はその週の月曜日を yyyy-MM-dd で指定してください：' + week);
  }
}

function pick_(obj, keys) {
  var out = {};
  keys.forEach(function (k) { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}
