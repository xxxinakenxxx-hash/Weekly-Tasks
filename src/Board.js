/**
 * 週間タスク画面のサーバー処理（IS-01）
 * 表示：対象週の正データを返す。確定：候補の採用と既存タスクの変更を1回でまとめて保存する。
 */

// 週間画面・朝ブリーフ画面で変更できる項目（IS-04で実施結果・メモ・次回申し送りを追加）
var BOARD_EDITABLE_KEYS = ['title', 'day', 'priority', 'focus', 'status', 'result', 'memo', 'handover'];
// 候補の採用時に保存する項目（IS-04で持越し元タスクIDを追加）
var BOARD_CREATE_KEYS = ['title', 'kind', 'day', 'priority', 'focus', 'status', 'exception', 'aiPosition', 'handover', 'sourceTaskId'];
// 翌週へ展開する状態
var CARRY_STATUSES = ['次週候補', '持越し'];

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
    // 対象週＋タスク名の完全一致で、この確定によって生じる重複を拒否する（既存行は変更しない）
    errors = errors.concat(findDuplicateTitles_(getTasks(targetWeek), creates, updates));
    // 持越し元タスクIDの確認：前の週に実在し、対象週へまだ取り込まれていないこと
    errors = errors.concat(checkCarrySources_(targetWeek, creates));
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

/**
 * 前週の「次週候補」「持越し」を対象週の候補として返す（保存はしない。確定は commitWeekBoard）。
 * すでに対象週へ取り込み済み（持越し元タスクIDが一致）またはタスク名が一致する行は除外し、名前を返す。
 */
function getCarryCandidates(targetWeek) {
  assertWeek_(targetWeek);
  var prevWeek = addDaysYmd_(targetWeek, -7);
  var current = getTasks(targetWeek);
  var carriedIds = current.map(function (t) { return t.sourceTaskId; }).filter(function (x) { return x; });
  var titles = current.map(function (t) { return String(t.title); });
  var candidates = [], excluded = [];
  getTasks(prevWeek).forEach(function (t) {
    if (CARRY_STATUSES.indexOf(t.status) < 0) return;
    if (carriedIds.indexOf(t.taskId) >= 0 || titles.indexOf(String(t.title)) >= 0) { excluded.push(String(t.title)); return; }
    candidates.push({
      title: t.title, kind: t.kind, day: '', priority: t.priority, focus: t.focus === true, status: '未着手',
      exception: t.exception, aiPosition: t.aiPosition, handover: t.handover, sourceTaskId: t.taskId,
      sourceStatus: t.status
    });
  });
  return { targetWeek: targetWeek, fromWeek: prevWeek, candidates: candidates, excluded: excluded };
}

// 持越し元タスクIDの検証（前の週に実在すること、同じ元からの二重取り込みでないこと）
function checkCarrySources_(targetWeek, creates) {
  var errors = [];
  var withSource = creates.filter(function (c) { return c.sourceTaskId; });
  if (!withSource.length) return errors;
  var all = getTasks();
  var used = getTasks(targetWeek).map(function (t) { return t.sourceTaskId; }).filter(function (x) { return x; });
  withSource.forEach(function (c) {
    var src = all.filter(function (t) { return t.taskId === c.sourceTaskId; })[0];
    if (!src) errors.push('持越し元タスクが見つかりません：' + c.sourceTaskId);
    else if (!(String(src.targetWeek) < String(targetWeek))) errors.push('持越し元は対象週より前の週のタスクだけです：' + c.title);
    if (used.indexOf(c.sourceTaskId) >= 0) errors.push('同じ持越し元からすでに取り込み済みです：' + c.title);
    used.push(c.sourceTaskId);
  });
  return errors;
}

function addDaysYmd_(ymd, n) {
  var p = String(ymd).split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}

// 確定後のタスク名を求め、追加・名前変更が対象週の他タスクと完全一致するものを返す
function findDuplicateTitles_(weekTasks, creates, updates) {
  var renamed = {};
  updates.forEach(function (u) {
    if (u.changes && u.changes.title !== undefined) renamed[u.taskId] = String(u.changes.title);
  });
  var after = weekTasks.map(function (t) {
    return { id: t.taskId, title: renamed.hasOwnProperty(t.taskId) ? renamed[t.taskId] : String(t.title) };
  });
  var errors = [];
  after.forEach(function (t) {
    if (!renamed.hasOwnProperty(t.id)) return;
    var clash = after.some(function (o) { return o.id !== t.id && o.title === t.title; });
    if (clash) errors.push('対象週に同名のタスクがすでにあるため名前を変更できません：' + t.title);
  });
  var titles = after.map(function (t) { return t.title; });
  creates.forEach(function (c) {
    var title = String(c.title);
    if (titles.indexOf(title) >= 0) errors.push('対象週に同名のタスクがすでにあるため追加できません：' + title);
    titles.push(title);
  });
  return errors;
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
