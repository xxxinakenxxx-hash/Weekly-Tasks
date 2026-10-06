// 保存済みタスクの削除（IS-06、A案：行は残して「削除済み」にする）のサーバー処理テスト：node tests/delete.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-10-05', P = '2026-09-28', N = '2026-10-12';
function setup() { const g = load(); g.setupSheets(); return g; }
const rows = g => g.__sheets['タスク'].data.length;

t('削除：行は残し「削除済み」にTRUE、履歴に「削除」を1行記録', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'TMPの今週業務・未処理件数確認', kind: '通常タスク' });
  g.createTask({ targetWeek: W, title: '残るタスク', kind: '通常タスク' });
  const before = rows(g);
  const r = g.deleteTask(W, a.taskId);
  assert.strictEqual(rows(g), before);
  const row = g.__sheets['タスク'].data.find(x => x[0] === a.taskId);
  assert.strictEqual(row[14], true);
  assert.strictEqual(row[2], 'TMPの今週業務・未処理件数確認');
  const h = g.getHistory(a.taskId);
  assert.deepStrictEqual([h.length, h[1].op, h[1].field, h[1].before, h[1].after], [2, '削除', '削除済み', '', 'TRUE']);
  assert.strictEqual(r.deletedTitle, 'TMPの今週業務・未処理件数確認');
  assert.deepStrictEqual([...r.tasks].map(x => x.title), ['残るタスク']);
});
t('削除済みは週間ボード・タスク一覧（朝ブリーフの今週タスクも同じ読込）に出ない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.createTask({ targetWeek: W, title: 'B', kind: '通常タスク' });
  g.deleteTask(W, a.taskId);
  assert.deepStrictEqual([...g.getWeekBoard(W).tasks].map(x => x.title), ['B']);
  assert.deepStrictEqual([...g.getTasks()].map(x => x.title), ['B']);
});
t('削除済みは変更できない（直接更新・週間ボードの確定とも拒否し、何も書かない）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.deleteTask(W, a.taskId);
  const h = g.getHistory().length;
  assert.throws(() => g.updateTask(a.taskId, { status: '完了' }), /削除済み/);
  assert.throws(() => g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { status: '完了' } }] }), /対象週/);
  assert.strictEqual(g.getHistory().length, h);
});
t('二重削除・別の週・存在しないIDは拒否し、何も書かない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  assert.throws(() => g.deleteTask(P, a.taskId), /対象週/);
  assert.throws(() => g.deleteTask(W, 'T-none'), /見つかりません/);
  g.deleteTask(W, a.taskId);
  const h = g.getHistory().length;
  assert.throws(() => g.deleteTask(W, a.taskId), /すでに削除済み/);
  assert.strictEqual(g.getHistory().length, h);
});
t('削除済みは持越し候補にならない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: P, title: '持越しA', kind: '通常タスク', status: '持越し' });
  g.createTask({ targetWeek: P, title: '持越しB', kind: '通常タスク', status: '次週候補' });
  g.deleteTask(P, a.taskId);
  assert.deepStrictEqual([...g.getCarryCandidates(W).candidates].map(c => c.title), ['持越しB']);
  assert.throws(() => g.commitWeekBoard(W, { creates: [{ title: '持越しA', kind: '通常タスク', sourceTaskId: a.taskId }] }), /見つかりません/);
});
t('取り込んだ持越し行を削除しても、元が再び候補に出ない（再登場しない）', () => {
  const g = setup();
  g.createTask({ targetWeek: P, title: '持越しA', kind: '通常タスク', status: '持越し' });
  g.commitWeekBoard(W, { creates: g.getCarryCandidates(W).candidates });
  const carried = g.getTasks(W)[0];
  g.deleteTask(W, carried.taskId);
  const r = g.getCarryCandidates(W);
  assert.strictEqual(r.candidates.length, 0);
  assert.throws(() => g.commitWeekBoard(W, { creates: [{ title: '持越しA', kind: '通常タスク', sourceTaskId: carried.sourceTaskId }] }), /取り込み済み/);
});
t('削除した名前は同じ週にもう一度追加できる（重複判定の対象外）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.deleteTask(W, a.taskId);
  g.commitWeekBoard(W, { creates: [{ title: 'A', kind: '通常タスク' }] });
  assert.strictEqual(g.getTasks(W).length, 1);
});
t('削除済み列が空欄の既存行を更新しても「削除済み」の履歴や値は増えない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.updateTask(a.taskId, { status: '進行中' });
  assert.deepStrictEqual(g.getHistory(a.taskId).map(h => h.field), ['', '状態']);
  assert.strictEqual(g.__sheets['タスク'].data[1][14], '');
});
t('移行：既存14列の「タスク」に15列目の見出しだけを追加し、既存の値は変えない', () => {
  const g = load();
  g.setupSheets();
  const sh = g.__sheets['タスク'];
  const h14 = [...g.headersOf_(g.SHEETS.TASKS)].slice(0, 14);
  sh.data = [h14.slice(), ['T-1', P, '旧タスク', '通常タスク', '木', '完了', 1, true, '', '', '', '', '', '']];
  const before = JSON.stringify(sh.data[1]);
  const tasks = g.getTasks(P);
  assert.strictEqual(sh.data[0][14], '削除済み');
  assert.strictEqual(JSON.stringify(sh.data[1].slice(0, 14)), before);
  assert.strictEqual(tasks.length, 1);
});
t('移行：既存13列なら14・15列目の見出しを追加する', () => {
  const g = load();
  g.setupSheets();
  const sh = g.__sheets['タスク'];
  sh.data = [[...g.headersOf_(g.SHEETS.TASKS)].slice(0, 13)];
  g.getTasks();
  assert.deepStrictEqual(sh.data[0].slice(13), ['持越し元タスクID', '削除済み']);
});
t('移行：「履歴」の操作列の入力規則に「削除」を足す（値・行は変えない）', () => {
  const g = load();
  g.setupSheets();
  const hs = g.__sheets['履歴'];
  hs.validations[3] = { list: ['作成', '修正', '状態変更'], allowInvalid: false };
  hs.data.push(['2026-10-05 10:00:00', 'T-1', '作成', '', '', '']);
  const before = JSON.stringify(hs.data);
  g.setupSheets();
  assert.deepStrictEqual([...hs.validations[3].list], ['作成', '修正', '状態変更', '削除']);
  assert.strictEqual(JSON.stringify(hs.data), before);
});
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
