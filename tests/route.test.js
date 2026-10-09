// 追加改修④（指示ルート：指示元 → 実装先）のサーバー処理テスト：node tests/route.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-10-05', N = '2026-10-12';
function setup() { const g = load(); g.setupSheets(); return g; }

t('列：「タスク」は17列（16列目＝指示元、17列目＝実装先）。入力規則は付けない', () => {
  const g = setup();
  const h = g.__sheets['タスク'].data[0];
  assert.strictEqual(h.length, 17);
  assert.deepStrictEqual([h[15], h[16]], ['指示元', '実装先']);
  assert.ok(!g.__sheets['タスク'].validations[16] && !g.__sheets['タスク'].validations[17]);
});
t('未登録：既存のAI案件は指示元・実装先が空欄のまま（推測で補わない）', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件' });
  const x = g.getTasks(W)[0];
  assert.deepStrictEqual([x.instructFrom, x.implementTo], ['', '']);
});
t('保存・再読込：AI案件ごとに個別に設定でき、Sheetsの16・17列目に入る', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件' });
  const b = g.createTask({ targetWeek: W, title: 'B', kind: 'AI案件' });
  g.commitWeekBoard(W, { updates: [
    { taskId: a.taskId, changes: { instructFrom: 'Claude', implementTo: 'Codex' } },
    { taskId: b.taskId, changes: { instructFrom: ' ChatGPT ', implementTo: 'Claude Code' } }] });
  const ts = g.getWeekBoard(W).tasks;
  assert.deepStrictEqual([ts[0].instructFrom, ts[0].implementTo], ['Claude', 'Codex']);
  assert.deepStrictEqual([ts[1].instructFrom, ts[1].implementTo], ['ChatGPT', 'Claude Code']);
  const row = g.__sheets['タスク'].data.find(r => r[0] === a.taskId);
  assert.deepStrictEqual([row[15], row[16]], ['Claude', 'Codex']);
});
t('履歴：指示元・実装先の変更は「修正」として変更前後が残る', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { instructFrom: 'Claude', implementTo: 'Codex' } }] });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { implementTo: 'Claude Code' } }] });
  const h = g.getHistory(a.taskId).slice(1).map(x => [x.op, x.field, x.before, x.after]);
  assert.deepStrictEqual(h, [['修正', '指示元', '', 'Claude'], ['修正', '実装先', '', 'Codex'], ['修正', '実装先', 'Codex', 'Claude Code']]);
});
t('空欄に戻せる（未設定）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', instructFrom: 'Claude', implementTo: 'Codex' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { instructFrom: '', implementTo: '' } }] });
  const x = g.getTasks(W)[0];
  assert.deepStrictEqual([x.instructFrom, x.implementTo], ['', '']);
});
t('通常タスクには設定できない（何も書かない）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  assert.throws(() => g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { instructFrom: 'Claude' } }] }), /指示ルート/);
  assert.strictEqual(g.getTasks(W)[0].instructFrom, '');
  assert.strictEqual(g.getHistory(a.taskId).length, 1);
});
t('翌週へ引き継ぐ：持越し・次週候補の取り込みで指示元・実装先もコピー（元の行はそのまま）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', instructFrom: 'Claude', implementTo: 'Codex', status: '持越し' });
  const b = g.createTask({ targetWeek: W, title: 'B', kind: 'AI案件', status: '次週候補' });
  const c = g.getCarryCandidates(N).candidates;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.map(x => [x.title, x.instructFrom, x.implementTo]))), [['A', 'Claude', 'Codex'], ['B', '', '']]);
  g.commitWeekBoard(N, { creates: c });
  const n = g.getTasks(N);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(n.map(x => [x.title, x.instructFrom, x.implementTo, x.sourceTaskId]))), [['A', 'Claude', 'Codex', a.taskId], ['B', '', '', b.taskId]]);
  const o = g.getTasks(W).find(x => x.taskId === a.taskId);
  assert.deepStrictEqual([o.instructFrom, o.implementTo, o.status], ['Claude', 'Codex', '持越し']);
});
t('保留（①）は従来どおり取り込み候補に出ない（指示ルートがあっても）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', instructFrom: 'Claude', implementTo: 'Codex' });
  g.updateTask(a.taskId, { status: '保留' });
  assert.strictEqual(g.getCarryCandidates(N).candidates.length, 0);
  assert.strictEqual(g.getTasks(W)[0].status, '保留');
});
t('移行：既存15列の「タスク」に16・17列目の見出しだけを追加し、既存の値・行は変えない', () => {
  const g = setup();
  const sh = g.__sheets['タスク'];
  const h15 = [...g.headersOf_(g.SHEETS.TASKS)].slice(0, 15);
  const row = ['T-1', W, '旧AI', 'AI案件', '木', '進行中', 1, true, '', '', '', '', 'P1', '', ''];
  sh.data = [h15.slice(), row.slice()];
  const before = JSON.stringify(sh.data[1]);
  const x = g.getTasks(W)[0];
  assert.deepStrictEqual(sh.data[0].slice(15), ['指示元', '実装先']);
  assert.strictEqual(JSON.stringify(sh.data[1].slice(0, 15)), before);
  assert.deepStrictEqual([x.instructFrom, x.implementTo, x.status, x.aiPosition], ['', '', '進行中', 'P1']);
  assert.strictEqual(g.getHistory().length, 0);
});
t('他項目の更新で指示ルートが変わらない／手動追加・AI同期にも影響しない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', instructFrom: 'Claude', implementTo: 'Codex' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { status: '進行中', memo: 'm' } }] });
  g.saveMorningBrief({ date: '2026-10-06', oneLine: 'x', flow: [], priorities: [], concerns: [], done: [], carryover: [],
    aiPositions: [{ taskId: a.taskId, title: 'A', result: '確認済み', position: 'P2', at: '2026-10-06 07:30' }] });
  const x = g.getTasks(W)[0];
  assert.deepStrictEqual([x.instructFrom, x.implementTo, x.aiPosition], ['Claude', 'Codex', 'P2']);
  const m = g.addManualTask(W, { title: 'M', kind: 'AI案件' }).task;
  assert.deepStrictEqual([m.instructFrom, m.implementTo], ['', '']);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
