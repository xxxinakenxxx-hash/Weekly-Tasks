// 追加実装 v1.2（週間タスク画面からの手動タスク追加）のサーバー処理テスト：node tests/manual_add.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-10-05', N = '2026-10-12';
function setup() { const g = load(); g.setupSheets(); return g; }
const rowsOf = (g, id) => g.__sheets['タスク'].data.filter(r => r[0] === id);
const brief = (date, ai) => ({ date, oneLine: '一言', flow: [], priorities: [], concerns: [], done: [], carryover: [], aiPositions: ai });
const ok = (taskId, position) => ({ taskId, title: 'X', result: '確認済み', position, at: '2026-10-06 07:30' });

t('通常タスク：確定タスクとして1行追加（状態は未着手、新しいタスクID、メモも保存）', () => {
  const g = setup();
  const res = g.addManualTask(W, { title: '  会議で決まった資料作成  ', kind: '通常タスク', day: '火', priority: 2, focus: true, memo: '部長から口頭依頼' });
  const x = res.task;
  assert.match(x.taskId, /^T-/);
  assert.strictEqual(x.title, '会議で決まった資料作成');
  assert.strictEqual(x.status, '未着手');
  assert.strictEqual(x.day, '火');
  assert.strictEqual(Number(x.priority), 2);
  assert.strictEqual(x.focus, true);
  assert.strictEqual(x.memo, '部長から口頭依頼');
  assert.strictEqual(x.targetWeek, W);
  assert.strictEqual(g.getTasks(W).length, 1);
  assert.strictEqual(rowsOf(g, x.taskId).length, 1);
});
t('未配置：曜日を選ばなければ未配置（曜日は空欄）', () => {
  const g = setup();
  const x = g.addManualTask(W, { title: '電話の折り返し', kind: '通常タスク' }).task;
  assert.strictEqual(x.day, '');
});
t('複数曜日：月・水・金で追加しても1行・1タスクID', () => {
  const g = setup();
  const x = g.addManualTask(W, { title: '自分で気づいた作業', kind: '通常タスク', day: '金,月,水' }).task;
  assert.strictEqual(x.day, '月,水,金');
  assert.strictEqual(rowsOf(g, x.taskId).length, 1);
  assert.strictEqual(g.__sheets['タスク'].data.length - 1, 1);
});
t('履歴：「作成／手動追加」が1行だけ残る（操作区分は既存の値）', () => {
  const g = setup();
  const x = g.addManualTask(W, { title: 'A', kind: '通常タスク' }).task;
  const h = g.getHistory(x.taskId);
  assert.strictEqual(h.length, 1);
  assert.strictEqual(h[0].op, '作成');
  assert.strictEqual(h[0].field, '手動追加');
  assert.ok(g.HISTORY_OPS.indexOf(h[0].op) >= 0);
});
t('入力規則・値を増やさない（状態・種別・操作区分・列はそのまま）', () => {
  const g = setup();
  const before = JSON.stringify([g.STATUS_VALUES, g.KIND_VALUES, g.HISTORY_OPS, g.SHEETS.TASKS.columns.length]);
  g.addManualTask(W, { title: 'A', kind: 'AI案件', day: '月,火', aiPosition: 'IS-02 途中' });
  assert.strictEqual(JSON.stringify([g.STATUS_VALUES, g.KIND_VALUES, g.HISTORY_OPS, g.SHEETS.TASKS.columns.length]), before);
  assert.strictEqual(g.__sheets['タスク'].data[0].length, g.SHEETS.TASKS.columns.length);
});
t('AI案件：AI案件現在地を持てる。通常タスクでは持てない（何も書かない）', () => {
  const g = setup();
  const x = g.addManualTask(W, { title: '新AI案件', kind: 'AI案件', aiPosition: 'P1 着手' }).task;
  assert.strictEqual(x.kind, 'AI案件');
  assert.strictEqual(x.aiPosition, 'P1 着手');
  assert.throws(() => g.addManualTask(W, { title: '通常', kind: '通常タスク', aiPosition: 'x' }), /AI案件現在地/);
  assert.strictEqual(g.getTasks(W).length, 1);
});
t('不正な入力は追加せず何も書かない（名前なし・同名・曜日・種別・優先度・週）', () => {
  const g = setup();
  g.addManualTask(W, { title: '既存', kind: '通常タスク' });
  const n = () => [g.__sheets['タスク'].data.length, g.__sheets['履歴'].data.length].join();
  const before = n();
  assert.throws(() => g.addManualTask(W, { title: '   ', kind: '通常タスク' }), /必須/);
  assert.throws(() => g.addManualTask(W, { title: '既存', kind: '通常タスク' }), /同名/);
  assert.throws(() => g.addManualTask(W, { title: 'B', kind: '通常タスク', day: '土' }), /曜日/);
  assert.throws(() => g.addManualTask(W, { title: 'B', kind: '別種別' }), /種別/);
  assert.throws(() => g.addManualTask(W, { title: 'B', kind: '通常タスク', priority: 0 }), /優先度/);
  assert.throws(() => g.addManualTask('2026-10-06', { title: 'B', kind: '通常タスク' }), /月曜日/);
  assert.strictEqual(n(), before);
});
t('受け付けない項目（状態・例外・持越し元・削除済み・タスクID）は無視する', () => {
  const g = setup();
  const x = g.addManualTask(W, { title: 'A', kind: '通常タスク', status: '完了', exception: '要確認：x', sourceTaskId: 'T-zzz', deleted: true, taskId: 'T-fixed' }).task;
  assert.strictEqual(x.status, '未着手');
  assert.strictEqual(x.exception, '');
  assert.strictEqual(x.sourceTaskId, '');
  assert.strictEqual(x.deleted, '');
  assert.notStrictEqual(x.taskId, 'T-fixed');
});
t('削除済みの同名タスクがあっても追加できる（削除済みは同名判定の対象外）', () => {
  const g = setup();
  const a = g.addManualTask(W, { title: 'A', kind: '通常タスク' }).task;
  g.deleteTask(W, a.taskId);
  const b = g.addManualTask(W, { title: 'A', kind: '通常タスク' }).task;
  assert.notStrictEqual(a.taskId, b.taskId);
  assert.strictEqual(g.getTasks(W).length, 1);
});
t('追加後は既存タスクと同じ：編集・曜日の移動・記録・状態変更・履歴', () => {
  const g = setup();
  const x = g.addManualTask(W, { title: 'A', kind: '通常タスク', day: '月,水' }).task;
  g.commitWeekBoard(W, { updates: [{ taskId: x.taskId, changes: { title: 'A改', day: '火,水', status: '進行中', result: '半分', memo: 'm', handover: 'h' } }] });
  const y = g.getTasks(W)[0];
  assert.deepStrictEqual([y.title, y.day, y.status, y.result, y.memo, y.handover], ['A改', '火,水', '進行中', '半分', 'm', 'h']);
  assert.strictEqual(rowsOf(g, x.taskId).length, 1);
  const ops = g.getHistory(x.taskId).map(h => h.op + '/' + h.field);
  assert.strictEqual(ops[0], '作成/手動追加');
  assert.ok(ops.indexOf('状態変更/状態') >= 0 && ops.indexOf('修正/曜日') >= 0);
});
t('追加後は既存タスクと同じ：削除（行は残し削除済み、履歴に削除）', () => {
  const g = setup();
  const x = g.addManualTask(W, { title: 'A', kind: '通常タスク' }).task;
  g.deleteTask(W, x.taskId);
  assert.strictEqual(g.getTasks(W).length, 0);
  assert.strictEqual(rowsOf(g, x.taskId).length, 1);
  assert.deepStrictEqual(g.getHistory(x.taskId).map(h => h.op), ['作成', '削除']);
});
t('追加後は既存タスクと同じ：持越し候補になり、翌週へ取り込める', () => {
  const g = setup();
  const x = g.addManualTask(W, { title: '口頭依頼', kind: '通常タスク', day: '金' }).task;
  g.updateTask(x.taskId, { status: '持越し', handover: '続き' });
  const c = g.getCarryCandidates(N);
  assert.strictEqual(c.candidates.length, 1);
  assert.strictEqual(c.candidates[0].sourceTaskId, x.taskId);
  g.commitWeekBoard(N, { creates: [c.candidates[0]] });
  assert.strictEqual(g.getTasks(N)[0].title, '口頭依頼');
  assert.strictEqual(g.getTasks(N)[0].sourceTaskId, x.taskId);
});
t('日次AI同期：手動追加のAI案件は、taskIdが一致しても同期しない（理由を返す）', () => {
  const g = setup();
  const m = g.addManualTask(W, { title: '手動AI', kind: 'AI案件', aiPosition: '手入力' }).task;
  const a = g.createTask({ targetWeek: W, title: '巡回AI', kind: 'AI案件' });
  const res = g.saveMorningBrief(brief('2026-10-06', [ok(m.taskId, '自動'), ok(a.taskId, '自動2')]));
  assert.strictEqual(res.aiSync.synced.length, 1);
  assert.strictEqual(res.aiSync.synced[0].taskId, a.taskId);
  assert.match(res.aiSync.skipped[0].reason, /手動追加/);
  assert.strictEqual(g.getTasks(W).find(x => x.taskId === m.taskId).aiPosition, '手入力');
  assert.strictEqual(g.getHistory(m.taskId).length, 1);
});
t('日次AI同期：手動追加のAI案件を翌週へ持ち越した行も同期しない', () => {
  const g = setup();
  const m = g.addManualTask(W, { title: '手動AI', kind: 'AI案件' }).task;
  g.updateTask(m.taskId, { status: '持越し' });
  g.commitWeekBoard(N, { creates: g.getCarryCandidates(N).candidates });
  const n = g.getTasks(N)[0];
  const res = g.saveMorningBrief(brief('2026-10-13', [Object.assign(ok(n.taskId, '自動'), { at: '2026-10-13 07:30' })]));
  assert.strictEqual(res.aiSync.synced.length, 0);
  assert.match(res.aiSync.skipped[0].reason, /手動追加/);
  assert.strictEqual(g.getTasks(N)[0].aiPosition, '');
});
t('朝ブリーフ：手動追加のタスクが今週タスクとして読める（曜日で今日のタスクに入る）', () => {
  const g = setup();
  g.addManualTask(W, { title: '火曜の会議メモ', kind: '通常タスク', day: '火,木' });
  const b = g.getWeekBoard(W);
  assert.strictEqual(b.tasks.length, 1);
  assert.ok(g.daysOf_(b.tasks[0].day).indexOf('火') >= 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
