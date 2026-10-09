/**
 * 週間タスク画面のサーバー処理（IS-01）
 * 表示：対象週の正データを返す。確定：候補の採用と既存タスクの変更を1回でまとめて保存する。
 */

// 週間画面・朝ブリーフ画面で変更できる項目（IS-04で実施結果・メモ・次回申し送り、IS-05で例外情報を追加）
// 追加改修④：指示ルート（指示元・実装先）を追加
var BOARD_EDITABLE_KEYS = ['title', 'day', 'priority', 'focus', 'status', 'result', 'memo', 'handover', 'exception', 'instructFrom', 'implementTo', 'caseKey'];
// 採用時に個別の確認が必要な例外区分（IS-05：情報源の不一致等を自動確定しない）
var CONFIRM_REQUIRED_EXCEPTIONS = ['不一致', 'チャット未確認'];
// 候補の採用時に保存する項目（IS-04で持越し元タスクIDを追加）
// 追加改修④：指示ルートも翌週へ引き継ぐ
var BOARD_CREATE_KEYS = ['title', 'kind', 'day', 'priority', 'focus', 'status', 'exception', 'aiPosition', 'handover', 'sourceTaskId', 'instructFrom', 'implementTo', 'caseKey'];
// 追加改修③：持越し・次週候補の取り込みでは、現在地の確認日時と最新取得も写す（現在地の根拠を失わない）
var CARRY_AI_STATE_KEYS = ['aiConfirmedAt', 'aiLatestAt', 'aiLatestResult', 'aiLatestPosition'];
// 翌週へ展開する状態（「保留」は含めない：翌週へ自動で回さず、元の週に保留のまま残す）
var CARRY_STATUSES = ['次週候補', '持越し'];
// 手動タスク追加（追加実装 v1.2）で受け付ける項目。状態は既存の初期値「未着手」
var MANUAL_ADD_KEYS = ['title', 'kind', 'day', 'priority', 'focus', 'memo', 'aiPosition'];
// 手動追加の履歴：既存の操作区分「作成」に、この項目名で記録する（操作区分の値は増やさない）
var MANUAL_ADD_FIELD = '手動追加';

/** 対象週の週間ボード（対象週省略時は今週） */
function getWeekBoard(targetWeek) {
  var week = targetWeek || currentWeek_();
  assertWeek_(week);
  return { targetWeek: week, tasks: getTasks(week), loadedAt: nowText_() };
}

/** タスク1件の変更履歴（古い順）。根拠・状態・時点の追跡用（IS-05） */
function getTaskHistory(taskId) {
  if (!taskId) throw new Error('タスクIDを指定してください。');
  // 画面へ渡せるよう、日付型に自動変換された値も文字列にする
  var rows = getHistory(taskId).map(function (h) {
    var o = {};
    Object.keys(h).forEach(function (k) {
      o[k] = Object.prototype.toString.call(h[k]) === '[object Date]' ? Utilities.formatDate(h[k], CONFIG.TIME_ZONE, 'yyyy-MM-dd') : String(h[k]);
    });
    return o;
  });
  return { taskId: taskId, history: rows, loadedAt: nowText_() };
}

/** 例外情報の区分一覧（「区分：内容」を「／」区切りで複数持てる。区分の後ろの「／」だけを区切りとみなす） */
function exceptionTypesOf_(text) {
  var s = String(text || '');
  if (!s) return [];
  var re = new RegExp('(?:^|／)(' + EXCEPTION_TYPES.join('|') + ')：', 'g');
  var out = [], m;
  while ((m = re.exec(s)) !== null) { if (out.indexOf(m[1]) < 0) out.push(m[1]); }
  return out;
}

function nowText_() {
  return Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
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
    // 追加改修④ 継続処理：案件キーのある新しいAI案件で、指示ルートが空欄なら前の週の同じ案件から引き継ぐ
    var inherited = applyCaseRoutes_(targetWeek, creates);
    var weekIds = getTasks(targetWeek).map(function (t) { return t.taskId; });
    var errors = [];
    creates.forEach(function (c, i) {
      // 不一致・チャット未確認の候補は、画面で個別に「確認した」ものだけ保存する（自動確定しない）
      var needs = exceptionTypesOf_(c.exception).filter(function (x) { return CONFIRM_REQUIRED_EXCEPTIONS.indexOf(x) >= 0; });
      if (needs.length && c.exceptionConfirmed !== true) {
        errors.push('追加' + (i + 1) + '件目「' + (c.title || '') + '」：' + needs.join('・') + 'があるため、内容を確認してから採用してください。');
      }
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
    // 同じ案件キーのAI案件が対象週に2件以上にならないこと（案件の取り違え防止）
    errors = errors.concat(findDuplicateCaseKeys_(getTasks(targetWeek), creates, updates));
    if (errors.length) throw new Error(errors.join('\n'));

    creates.forEach(function (c) {
      var fields = Object.assign(pick_(c, BOARD_CREATE_KEYS), { targetWeek: targetWeek });
      if (c.sourceTaskId) Object.assign(fields, carryAiState_(c.sourceTaskId));
      createTask_(fields);
    });
    updates.forEach(function (u) {
      updateTask_(u.taskId, pick_(u.changes || {}, BOARD_EDITABLE_KEYS));
    });
    return { targetWeek: targetWeek, tasks: getTasks(targetWeek), created: creates.length, updated: updates.length, routeInherited: inherited, loadedAt: nowText_() };
  });
}

/**
 * 案件キーごとの、前の週の指示ルート（追加改修④ 継続処理）。保存はしない（週間画面の候補表示用）。
 * 対象週より前の週で、同じ案件キー（削除済みを除くAI案件）の最も新しい週の行の指示元・実装先を返す。
 * その週に同じキーの行が複数あり、指示ルートが食い違う場合は ambiguous とし、値を返さない（推測しない）。
 */
function getCaseRoutes(targetWeek, keys) {
  assertWeek_(targetWeek);
  var all = getTasks();
  var out = {};
  (keys || []).forEach(function (k) {
    if (String(k || '').trim()) out[k] = caseRouteOf_(all, targetWeek, k);
  });
  return { targetWeek: targetWeek, routes: out };
}

function caseRouteOf_(all, targetWeek, key) {
  var nk = caseKeyNorm_(key);
  var rows = all.filter(function (t) {
    return t.kind === 'AI案件' && caseKeyNorm_(t.caseKey) === nk && String(t.targetWeek) < String(targetWeek);
  });
  if (!rows.length) return { found: false };
  var latest = rows.reduce(function (m, t) { return String(t.targetWeek) > m ? String(t.targetWeek) : m; }, '');
  var same = rows.filter(function (t) { return String(t.targetWeek) === latest; });
  var routes = same.map(function (t) { return String(t.instructFrom || '') + '\t' + String(t.implementTo || ''); });
  if (routes.some(function (r) { return r !== routes[0]; })) return { found: false, ambiguous: true, fromWeek: latest };
  return { found: true, fromWeek: latest, instructFrom: String(same[0].instructFrom || ''), implementTo: String(same[0].implementTo || '') };
}

// 新しいAI案件（案件キーあり、指示元・実装先とも空欄）に、前の週の同じ案件の指示ルートを入れる。入れたものを返す
function applyCaseRoutes_(targetWeek, creates) {
  var targets = creates.filter(function (c) {
    return c.kind === 'AI案件' && String(c.caseKey || '').trim() && !String(c.instructFrom || '').trim() && !String(c.implementTo || '').trim();
  });
  if (!targets.length) return [];
  var all = getTasks();
  var out = [];
  targets.forEach(function (c) {
    var r = caseRouteOf_(all, targetWeek, c.caseKey);
    if (!r.found || (!r.instructFrom && !r.implementTo)) return;
    c.instructFrom = r.instructFrom;
    c.implementTo = r.implementTo;
    out.push({ title: String(c.title), fromWeek: r.fromWeek, instructFrom: r.instructFrom, implementTo: r.implementTo });
  });
  return out;
}

// 確定後の案件キーが、対象週の他のAI案件と重ならないこと
function findDuplicateCaseKeys_(weekTasks, creates, updates) {
  var changed = {};
  updates.forEach(function (u) {
    if (u.changes && u.changes.caseKey !== undefined) changed[u.taskId] = String(u.changes.caseKey);
  });
  var keys = weekTasks.map(function (t) { return { title: String(t.title), key: changed.hasOwnProperty(t.taskId) ? changed[t.taskId] : String(t.caseKey || '') }; })
    .concat(creates.map(function (c) { return { title: String(c.title), key: String(c.caseKey || '') }; }));
  var seen = {}, errors = [];
  keys.forEach(function (x) {
    var k = caseKeyNorm_(x.key);
    if (!k) return;
    if (seen[k]) errors.push('対象週に同じ案件キーのAI案件がすでにあります（「' + seen[k] + '」と「' + x.title + '」）：' + x.key);
    else seen[k] = x.title;
  });
  return errors;
}

/**
 * 手動タスク追加（追加実装 v1.2）。AI／Workで拾えないタスクを、候補ではなく確定タスクとして「タスク」へ1行追加する。
 * 新しいタスクIDを採番し、複数曜日でも1行のまま。履歴は「作成／手動追加」。対象週に同名のタスクがあれば追加しない。
 */
function addManualTask(targetWeek, input) {
  assertWeek_(targetWeek);
  var fields = pick_(input || {}, MANUAL_ADD_KEYS);
  if (typeof fields.title === 'string') fields.title = fields.title.trim();
  var task = Object.assign(fields, { targetWeek: targetWeek, status: '未着手' });
  return withLock_(function () {
    prepareCreate_(task);
    var dup = findDuplicateTitles_(getTasks(targetWeek), [task], []);
    if (dup.length) throw new Error(dup.join('\n'));
    var created = createTask_(task, MANUAL_ADD_FIELD);
    var saved = getTasks(targetWeek).filter(function (t) { return t.taskId === created.taskId; })[0];
    return { targetWeek: targetWeek, task: saved, loadedAt: nowText_() };
  });
}

/**
 * 手動追加のタスク（履歴「作成／手動追加」）か、持越し元をたどると手動追加のタスクに行き着くタスクのIDの一覧（追加実装 v1.2）。
 * ローカルのAI案件との安全な taskId 対応が成立していないため、日次AI現在地の自動同期の対象外にする。
 */
function manualTaskIds_() {
  var manual = {};
  getHistory().forEach(function (h) { if (h.op === '作成' && h.field === MANUAL_ADD_FIELD) manual[h.taskId] = true; });
  var all = getTasksIncludingDeleted_();
  var src = {};
  all.forEach(function (t) { src[t.taskId] = String(t.sourceTaskId || ''); });
  var out = {};
  all.forEach(function (t) {
    var id = t.taskId, seen = {};
    while (id && !seen[id]) {
      if (manual[id]) { out[t.taskId] = true; break; }
      seen[id] = true;
      id = src[id];
    }
  });
  return out;
}

/**
 * 保存済みタスクを削除済みにする（IS-06）。Sheetsの行は残し、「削除済み」列と履歴「削除」で記録する。
 * 削除済みのタスクは、週間ボード・朝ブリーフの今週タスク・持越し候補・重複判定の対象外になる。
 */
function deleteTask(targetWeek, taskId) {
  assertWeek_(targetWeek);
  if (!taskId) throw new Error('タスクIDを指定してください。');
  return withLock_(function () {
    var t = markTaskDeleted_(targetWeek, taskId);
    // 返す値は最小限（画面側で該当カードを外す）
    return { targetWeek: targetWeek, taskId: taskId, deletedTitle: String(t.title), loadedAt: nowText_() };
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
  // 取り込み済みの判定は削除済みの行も含める（削除した持越し行の元が、再び候補に出てこないようにする）
  var carriedIds = getTasksIncludingDeleted_(targetWeek).map(function (t) { return t.sourceTaskId; }).filter(function (x) { return x; });
  var titles = current.map(function (t) { return String(t.title); });
  var candidates = [], excluded = [];
  getTasks(prevWeek).forEach(function (t) {
    if (CARRY_STATUSES.indexOf(t.status) < 0) return;
    if (carriedIds.indexOf(t.taskId) >= 0 || titles.indexOf(String(t.title)) >= 0) { excluded.push(String(t.title)); return; }
    candidates.push({
      title: t.title, kind: t.kind, day: '', priority: t.priority, focus: t.focus === true, status: '未着手',
      exception: t.exception, aiPosition: t.aiPosition, handover: t.handover, sourceTaskId: t.taskId,
      instructFrom: String(t.instructFrom || ''), implementTo: String(t.implementTo || ''), caseKey: String(t.caseKey || ''),
      sourceStatus: t.status
    });
  });
  return { targetWeek: targetWeek, fromWeek: prevWeek, candidates: candidates, excluded: excluded };
}

// 持越し元の現在地の確認日時・最新取得（正データから読む。画面から渡された値は使わない）
function carryAiState_(sourceTaskId) {
  var src = getTasksIncludingDeleted_().filter(function (t) { return t.taskId === sourceTaskId; })[0];
  if (!src || src.kind !== 'AI案件') return {};
  var out = {};
  CARRY_AI_STATE_KEYS.forEach(function (k) { out[k] = src[k] === undefined ? '' : src[k]; });
  return out;
}

// 持越し元タスクIDの検証（前の週に実在すること、同じ元からの二重取り込みでないこと）
function checkCarrySources_(targetWeek, creates) {
  var errors = [];
  var withSource = creates.filter(function (c) { return c.sourceTaskId; });
  if (!withSource.length) return errors;
  var all = getTasks();
  var used = getTasksIncludingDeleted_(targetWeek).map(function (t) { return t.sourceTaskId; }).filter(function (x) { return x; });
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
