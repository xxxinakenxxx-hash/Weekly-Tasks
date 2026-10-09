/**
 * 追加改修④③：既存AI案件への案件キーの初期登録（1回だけ。ユーザーの承認後に実行する）
 *
 * 出典：Google Drive「週間タスクボード」/「週間タスク」/AI案件.md（確認日 2026-10-05、Desktop版Workの週次AI巡回）。
 * 各案件の「参照した情報源 - TASK_CURRENT.md：（場所）」を案件キーとする。
 * 対応の根拠：2026-10-05週の「タスク」行は、この AI案件.md から作った週間分析JSONで作成された（TASK_CURRENT.md IS-06 ①〜③）。
 * AI案件.md の見出し（## N. 案件名）と「タスク」のタスク名が完全一致し、4件が1対1で対応する。名称の揺れ・重複は対象にしない。
 *
 * 書き込み前に、行が実在すること・対象週・種別AI案件・削除済みでない・タスク名が一致・案件キーが空欄・同じ案件キーが他の行に無いことを
 * 1件ずつ確認し、1件でも条件を満たさなければ何も書かない。書き込みは updateTask_ で行い、履歴（修正／案件キー）を残す。
 */
var CASE_KEY_BACKFILL = {
  id: 'casekey-backfill-2026-10-05',
  source: 'AI案件.md（確認日 2026-10-05）',
  targetWeek: '2026-10-05',
  items: [
    { taskId: 'T-04eb18ae-795d-4675-96e6-8f0b2641620c', title: '機械売上管理システム', heading: '## 1. 機械売上管理システム',
      caseKey: 'C:\\Users\\inamori240\\Documents\\machine-sales-system\\tasks\\TASK_CURRENT.md' },
    { taskId: 'T-8baaebbc-440f-4d48-a303-49784e3892ab', title: '機械販売事例アプリ', heading: '## 2. 機械販売事例アプリ',
      caseKey: 'C:\\Users\\inamori240\\Documents\\機械販売事例アプリ\\tasks\\TASK_CURRENT.md' },
    { taskId: 'T-5f3eb930-f766-4ce3-a653-c06361c518ac', title: '営業AIメモ', heading: '## 3. 営業AIメモ',
      caseKey: 'C:\\Users\\inamori240\\Documents\\営業AIメモ\\tasks\\TASK_CURRENT.md' },
    { taskId: 'T-9fa0d5fa-3660-47a6-9562-6cdc64cc9ebb', title: '管理職AIメモ', heading: '## 4. 管理職AIメモ',
      caseKey: 'C:\\Users\\inamori240\\Documents\\管理職AIメモ\\tasks\\TASK_CURRENT.md' }
  ]
};

/** 初期登録の計画（読むだけ。書き込まない） */
function getCaseKeyBackfillPlan() {
  return caseKeyBackfillPlan_(CASE_KEY_BACKFILL);
}

/** 初期登録の実行（全件が条件を満たすときだけ書き込む。すでに登録済みの行は書き換えない） */
function applyCaseKeyBackfill(planId) {
  if (planId !== CASE_KEY_BACKFILL.id) throw new Error('計画が一致しません。画面を再読込してください。');
  return withLock_(function () {
    var plan = caseKeyBackfillPlan_(CASE_KEY_BACKFILL);
    if (!plan.canApply) throw new Error('条件を満たさない行があるため、何も書き込みませんでした：' + plan.rows.filter(function (r) { return !r.ok; }).map(function (r) { return r.title + '（' + r.reason + '）'; }).join('、'));
    var written = [];
    plan.rows.forEach(function (r) {
      if (r.state !== 'todo') return;
      updateTask_(r.taskId, { caseKey: r.after });
      written.push(r.taskId);
    });
    var after = caseKeyBackfillPlan_(CASE_KEY_BACKFILL);
    after.written = written;
    return after;
  });
}

function caseKeyBackfillPlan_(def) {
  var all = getTasksIncludingDeleted_();
  var rows = def.items.map(function (it) {
    var r = { taskId: it.taskId, title: it.title, heading: it.heading, before: '', after: it.caseKey, ok: false, state: 'ng', reason: '' };
    var t = all.filter(function (x) { return x.taskId === it.taskId; })[0];
    if (!t) { r.reason = '行が見つからない'; return r; }
    r.before = String(t.caseKey || '');
    r.instructRoute = [String(t.instructFrom || ''), String(t.implementTo || '')];
    if (t.deleted === true) r.reason = '削除済み';
    else if (String(t.targetWeek) !== def.targetWeek) r.reason = '対象週が違う（' + t.targetWeek + '）';
    else if (t.kind !== 'AI案件') r.reason = '種別がAI案件ではない';
    else if (String(t.title) !== it.title) r.reason = 'タスク名が一致しない（' + t.title + '）';
    else if (caseKeyNorm_(r.before) === caseKeyNorm_(it.caseKey)) { r.ok = true; r.state = 'done'; r.reason = '登録済み'; }
    else if (r.before !== '') r.reason = '別の案件キーが入っている';
    else if (all.some(function (x) { return x.taskId !== it.taskId && x.deleted !== true && String(x.targetWeek) === def.targetWeek && caseKeyNorm_(x.caseKey) === caseKeyNorm_(it.caseKey); })) r.reason = '同じ週に同じ案件キーの行がある';
    else { r.ok = true; r.state = 'todo'; r.reason = '登録する'; }
    return r;
  });
  var keys = def.items.map(function (it) { return caseKeyNorm_(it.caseKey); });
  var dup = keys.some(function (k, i) { return keys.indexOf(k) !== i; });
  return {
    id: def.id, source: def.source, targetWeek: def.targetWeek, rows: rows,
    canApply: !dup && rows.every(function (r) { return r.ok; }) && rows.some(function (r) { return r.state === 'todo'; }),
    done: rows.every(function (r) { return r.state === 'done'; }),
    loadedAt: nowText_()
  };
}
