// 週間ボード（IS-01）のサーバー処理テスト：node tests/board.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-09-28';
function setup() { const g = load(); g.setupSheets(); return g; }

t('getWeekBoard：対象週のタスクだけを返す', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.createTask({ targetWeek: '2026-10-05', title: 'B', kind: 'AI案件' });
  const b = g.getWeekBoard(W);
  assert.strictEqual(b.targetWeek, W);
  assert.deepStrictEqual(b.tasks.map(x => x.title), ['A']);
});
t('getWeekBoard：対象週省略時は今週の月曜日', () => {
  const g = setup();
  const w = g.getWeekBoard().targetWeek;
  assert.ok(g.isMonday_(w), w);
});
t('getWeekBoard：月曜日以外はエラー', () => {
  const g = setup();
  assert.throws(() => g.getWeekBoard('2026-09-29'), /月曜日/);
});
t('commitWeekBoard：候補採用（通常/AI混在）→保存→再読込で一致、履歴「作成」', () => {
  const g = setup();
  const r = g.commitWeekBoard(W, { creates: [
    { title: '勤怠', kind: '通常タスク', day: '木', priority: 1, focus: true, exception: '要確認：修正要否' },
    { title: 'IS-01', kind: 'AI案件', day: '', priority: 2, focus: false }
  ] });
  assert.strictEqual(r.created, 2);
  const tasks = g.getWeekBoard(W).tasks;
  assert.deepStrictEqual(tasks.map(x => [x.title, x.kind, x.day, x.priority, x.focus, x.status, x.targetWeek]),
    [['勤怠', '通常タスク', '木', 1, true, '未着手', W], ['IS-01', 'AI案件', '', 2, false, '未着手', W]]);
  assert.strictEqual(tasks[0].exception, '要確認：修正要否');
  assert.deepStrictEqual(g.getHistory().map(h => h.op), ['作成', '作成']);
});
t('commitWeekBoard：既存タスクの名前・曜日・優先度・重点・状態を変更し、履歴が残る', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { title: 'A2', day: '月', priority: 3, focus: true, status: '進行中' } }] });
  const x = g.getWeekBoard(W).tasks[0];
  assert.deepStrictEqual([x.title, x.day, x.priority, x.focus, x.status], ['A2', '月', 3, true, '進行中']);
  const h = g.getHistory(a.taskId);
  assert.deepStrictEqual(h.map(e => e.op + ':' + e.field), ['作成:', '修正:タスク名／案件名', '修正:曜日', '状態変更:状態', '修正:優先度', '修正:重点']);
});
t('commitWeekBoard：状態5値すべて保存・再読込できる', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件' });
  g.STATUS_VALUES.forEach(s => {
    g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { status: s } }] });
    assert.strictEqual(g.getWeekBoard(W).tasks[0].status, s);
  });
});
t('commitWeekBoard：1件でも不正なら何も書かない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  assert.throws(() => g.commitWeekBoard(W, {
    creates: [{ title: 'OK', kind: '通常タスク' }, { title: 'NG', kind: 'その他' }],
    updates: [{ taskId: a.taskId, changes: { status: '完了' } }]
  }), /2件目/);
  assert.strictEqual(g.getWeekBoard(W).tasks.length, 1);
  assert.strictEqual(g.getWeekBoard(W).tasks[0].status, '未着手');
  assert.strictEqual(g.getHistory().length, 1);
});
t('commitWeekBoard：変更できない項目（種別・対象週・ID・例外情報）は無視する', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { exception: '要確認：x', kind: 'AI案件', targetWeek: '2026-10-05', taskId: 'T-x', status: '完了' } }] });
  const x = g.getWeekBoard(W).tasks[0];
  assert.deepStrictEqual([x.exception, x.kind, x.targetWeek, x.taskId, x.status], ['', '通常タスク', W, a.taskId, '完了']);
});
t('commitWeekBoard：別の週のタスクは変更できない', () => {
  const g = setup();
  const b = g.createTask({ targetWeek: '2026-10-05', title: 'B', kind: '通常タスク' });
  assert.throws(() => g.commitWeekBoard(W, { updates: [{ taskId: b.taskId, changes: { status: '完了' } }] }), /対象週/);
});
t('commitWeekBoard：候補の対象週はボードの週で保存する', () => {
  const g = setup();
  g.commitWeekBoard(W, { creates: [{ title: 'C', kind: '通常タスク', targetWeek: '2026-10-05' }] });
  assert.strictEqual(g.getWeekBoard(W).tasks.length, 1);
});
t('commitWeekBoard：変更なしはエラー', () => {
  const g = setup();
  assert.throws(() => g.commitWeekBoard(W, {}), /変更がありません/);
});
t('commitWeekBoard：AI案件の候補は AI案件現在地 と 不一致/チャット未確認 の例外情報を保存する', () => {
  const g = setup();
  g.commitWeekBoard(W, { creates: [
    { title: '週間タスク・朝ブリーフ', kind: 'AI案件', aiPosition: 'IS-02 途中／手番：ユーザー', exception: '不一致：TASK_CURRENTとDriveの工程が異なる' },
    { title: '別案件', kind: 'AI案件', aiPosition: 'IS-01 完了', exception: 'チャット未確認：対応するCodexチャットを特定できない' }
  ] });
  const tasks = g.getWeekBoard(W).tasks;
  assert.deepStrictEqual(tasks.map(x => [x.aiPosition, x.exception]), [
    ['IS-02 途中／手番：ユーザー', '不一致：TASK_CURRENTとDriveの工程が異なる'],
    ['IS-01 完了', 'チャット未確認：対応するCodexチャットを特定できない']]);
});
t('commitWeekBoard：通常タスクに AI案件現在地 は保存できない（何も書かない）', () => {
  const g = setup();
  assert.throws(() => g.commitWeekBoard(W, { creates: [{ title: 'X', kind: '通常タスク', aiPosition: 'x' }] }), /AI案件/);
  assert.strictEqual(g.getWeekBoard(W).tasks.length, 0);
});
t('重複防止：対象週に同名の既存タスクがある候補は追加を拒否し、何も書かない', () => {
  const g = setup();
  ['関東販売', 'AIレポート', '丸菱HD', '10月誕生日'].forEach(x => g.createTask({ targetWeek: W, title: x, kind: '通常タスク' }));
  assert.throws(() => g.commitWeekBoard(W, { creates: [{ title: '新規', kind: '通常タスク' }, { title: '丸菱HD', kind: '通常タスク' }] }), /同名.*丸菱HD/);
  assert.strictEqual(g.getWeekBoard(W).tasks.length, 4);
  assert.strictEqual(g.getHistory().length, 4);
});
t('重複防止：同じ確定内で同名の候補を2件追加できない', () => {
  const g = setup();
  assert.throws(() => g.commitWeekBoard(W, { creates: [{ title: 'X', kind: '通常タスク' }, { title: 'X', kind: 'AI案件' }] }), /同名/);
  assert.strictEqual(g.getWeekBoard(W).tasks.length, 0);
});
t('重複防止：既存タスクを他の既存タスクと同名に変更できない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.createTask({ targetWeek: W, title: 'B', kind: '通常タスク' });
  assert.throws(() => g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { title: 'B' } }] }), /名前を変更できません/);
  assert.strictEqual(g.getWeekBoard(W).tasks.find(t => t.taskId === a.taskId).title, 'A');
});
t('重複防止：別の週の同名タスクは重複扱いしない／完全一致のみ（類似名は追加できる）', () => {
  const g = setup();
  g.createTask({ targetWeek: '2026-09-21', title: '丸菱HD', kind: '通常タスク' });
  g.createTask({ targetWeek: W, title: '丸菱HD売上データの照合', kind: '通常タスク' });
  const r = g.commitWeekBoard(W, { creates: [{ title: '丸菱HD', kind: '通常タスク' }, { title: '丸菱HD売上データの照合 ', kind: '通常タスク' }] });
  assert.strictEqual(r.created, 2);
});
t('重複防止：既存データに重複が残っていても、それに関係しない確定は止めない', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: 'D', kind: '通常タスク' });
  g.createTask({ targetWeek: W, title: 'D', kind: '通常タスク' });
  const r = g.commitWeekBoard(W, { creates: [{ title: 'E', kind: '通常タスク' }] });
  assert.strictEqual(r.created, 1);
});
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
