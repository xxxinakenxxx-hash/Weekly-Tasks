// 追加改修④（指示ルート：指示元 → 実装先）のサーバー処理テスト：node tests/route.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-10-05', N = '2026-10-12';
function setup() { const g = load(); g.setupSheets(); return g; }

t('列：「タスク」は18列（16列目＝指示元、17列目＝実装先、18列目＝案件キー）。入力規則は付けない', () => {
  const g = setup();
  const h = g.__sheets['タスク'].data[0];
  assert.strictEqual(h.length, 18);
  assert.deepStrictEqual([h[15], h[16], h[17]], ['指示元', '実装先', '案件キー']);
  assert.ok(!g.__sheets['タスク'].validations[16] && !g.__sheets['タスク'].validations[17] && !g.__sheets['タスク'].validations[18]);
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
t('移行：既存15列の「タスク」に16〜18列目の見出しだけを追加し、既存の値・行は変えない', () => {
  const g = setup();
  const sh = g.__sheets['タスク'];
  const h15 = [...g.headersOf_(g.SHEETS.TASKS)].slice(0, 15);
  const row = ['T-1', W, '旧AI', 'AI案件', '木', '進行中', 1, true, '', '', '', '', 'P1', '', ''];
  sh.data = [h15.slice(), row.slice()];
  const before = JSON.stringify(sh.data[1]);
  const x = g.getTasks(W)[0];
  assert.deepStrictEqual(sh.data[0].slice(15), ['指示元', '実装先', '案件キー']);
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

// ---- 継続処理：案件キーで前の週の指示ルートを引き継ぐ ----
const KA = 'C:\\Users\\inamori240\\Documents\\営業AIメモ\\tasks\\TASK_CURRENT.md';
const KB = 'C:\\Users\\inamori240\\Documents\\機械販売事例アプリ\\tasks\\TASK_CURRENT.md';
const P = '2026-09-28';
const plain = x => JSON.parse(JSON.stringify(x));
t('継続：週間分析で同じ案件キーのAI案件を新規作成すると、前の週の指示元・実装先を引き継ぐ', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: '営業AIメモ', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex' });
  const res = g.commitWeekBoard(N, { creates: [{ title: '営業AIメモ（P2-09）', kind: 'AI案件', caseKey: KA }] });
  const x = g.getTasks(N)[0];
  assert.deepStrictEqual([x.instructFrom, x.implementTo, x.caseKey], ['Claude', 'Codex', KA]);
  assert.deepStrictEqual(plain(res.routeInherited), [{ title: '営業AIメモ（P2-09）', fromWeek: W, instructFrom: 'Claude', implementTo: 'Codex' }]);
  assert.strictEqual(g.getHistory(x.taskId).length, 1);
});
t('継続：タスク名が同じでも、案件キーが無ければ引き継がない（名前で推測しない）', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: '営業AIメモ', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex' });
  g.commitWeekBoard(N, { creates: [{ title: '営業AIメモ', kind: 'AI案件' }] });
  const x = g.getTasks(N)[0];
  assert.deepStrictEqual([x.instructFrom, x.implementTo], ['', '']);
});
t('継続：案件キーが違えば、名前が同じでも引き継がない', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex' });
  g.commitWeekBoard(N, { creates: [{ title: 'X', kind: 'AI案件', caseKey: KB }] });
  assert.deepStrictEqual([g.getTasks(N)[0].instructFrom, g.getTasks(N)[0].implementTo], ['', '']);
});
t('継続：案件キーは「/」「\\」・大文字小文字・前後の空白の違いを同じとみなす', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex' });
  g.commitWeekBoard(N, { creates: [{ title: 'X', kind: 'AI案件', caseKey: '  ' + KA.replace(/\\/g, '/').replace('TASK_CURRENT.md', 'task_current.md') + ' ' }] });
  assert.strictEqual(g.getTasks(N)[0].instructFrom, 'Claude');
});
t('継続：いちばん新しい週の値を使う。ユーザーが空欄に戻した場合は空欄を引き継ぐ（古い値を復活させない）', () => {
  const g = setup();
  g.createTask({ targetWeek: P, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: '古い', implementTo: '古い' });
  const w = g.createTask({ targetWeek: W, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex' });
  g.commitWeekBoard(N, { creates: [{ title: 'X', kind: 'AI案件', caseKey: KA }] });
  assert.strictEqual(g.getTasks(N)[0].instructFrom, 'Claude');
  const g2 = setup();
  g2.createTask({ targetWeek: P, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: '古い', implementTo: '古い' });
  const y = g2.createTask({ targetWeek: W, title: 'X', kind: 'AI案件', caseKey: KA });
  g2.commitWeekBoard(N, { creates: [{ title: 'X', kind: 'AI案件', caseKey: KA }] });
  assert.deepStrictEqual([g2.getTasks(N)[0].instructFrom, g2.getTasks(N)[0].implementTo], ['', '']);
});
t('継続：前の週に同じ案件キーで指示ルートが食い違う行がある場合は引き継がない（特定できない）', () => {
  const g = setup();
  g.createTask({ targetWeek: P, title: 'X1', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex' });
  g.createTask({ targetWeek: P, title: 'X2', kind: 'AI案件', caseKey: KA, instructFrom: 'ChatGPT', implementTo: 'Claude Code' });
  const r = g.getCaseRoutes(W, [KA]).routes[KA];
  assert.strictEqual(r.found, false);
  assert.strictEqual(r.ambiguous, true);
  g.commitWeekBoard(W, { creates: [{ title: 'X', kind: 'AI案件', caseKey: KA }] });
  assert.strictEqual(g.getTasks(W)[0].instructFrom, '');
});
t('継続：週間分析で指示ルートを指定した場合はそれを使う（引継ぎで上書きしない）', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex' });
  g.commitWeekBoard(N, { creates: [{ title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: 'ChatGPT', implementTo: '' }] });
  assert.deepStrictEqual([g.getTasks(N)[0].instructFrom, g.getTasks(N)[0].implementTo], ['ChatGPT', '']);
});
t('継続：削除済み・対象週以降・通常タスクの行からは引き継がない', () => {
  const g = setup();
  const d = g.createTask({ targetWeek: W, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: '削除', implementTo: '削除' });
  g.deleteTask(W, d.taskId);
  g.createTask({ targetWeek: '2026-10-19', title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: '未来', implementTo: '未来' });
  g.commitWeekBoard(N, { creates: [{ title: 'X', kind: 'AI案件', caseKey: KA }] });
  assert.deepStrictEqual([g.getTasks(N)[0].instructFrom, g.getTasks(N)[0].implementTo], ['', '']);
});
t('継続：ユーザーが明示的に変更した場合だけ更新する（前の週の行・後の週の行は自動で変わらない）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex' });
  g.commitWeekBoard(N, { creates: [{ title: 'X', kind: 'AI案件', caseKey: KA }] });
  const n = g.getTasks(N)[0];
  g.commitWeekBoard(N, { updates: [{ taskId: n.taskId, changes: { implementTo: 'Claude Code' } }] });
  assert.strictEqual(g.getTasks(W)[0].implementTo, 'Codex');
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { instructFrom: 'ChatGPT' } }] });
  assert.strictEqual(g.getTasks(N)[0].instructFrom, 'Claude');
  assert.strictEqual(g.getTasks(N)[0].implementTo, 'Claude Code');
});
t('継続：案件キーを後から設定しても、指示ルートは自動で変わらない', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex' });
  const n = g.createTask({ targetWeek: N, title: 'X', kind: 'AI案件' });
  g.commitWeekBoard(N, { updates: [{ taskId: n.taskId, changes: { caseKey: KA } }] });
  const x = g.getTasks(N)[0];
  assert.deepStrictEqual([x.caseKey, x.instructFrom, x.implementTo], [KA, '', '']);
  assert.ok(g.getHistory(n.taskId).some(h => h.field === '案件キー' && h.after === KA));
});
t('識別：対象週に同じ案件キーのAI案件は2件にできない（追加・変更とも。何も書かない）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', caseKey: KA });
  const b = g.createTask({ targetWeek: W, title: 'B', kind: 'AI案件' });
  const n = g.__sheets['タスク'].data.length;
  assert.throws(() => g.commitWeekBoard(W, { creates: [{ title: 'C', kind: 'AI案件', caseKey: KA }] }), /同じ案件キー/);
  assert.throws(() => g.commitWeekBoard(W, { updates: [{ taskId: b.taskId, changes: { caseKey: KA.toLowerCase() } }] }), /同じ案件キー/);
  assert.throws(() => g.commitWeekBoard(W, { creates: [{ title: 'C', kind: 'AI案件', caseKey: KB }, { title: 'D', kind: 'AI案件', caseKey: KB }] }), /同じ案件キー/);
  assert.strictEqual(g.__sheets['タスク'].data.length, n);
  assert.strictEqual(g.getTasks(W).find(t => t.taskId === b.taskId).caseKey, '');
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { caseKey: '' } }, { taskId: b.taskId, changes: { caseKey: KA } }] });
  assert.strictEqual(g.getTasks(W).find(t => t.taskId === b.taskId).caseKey, KA);
});
t('識別：案件キーは TASK_CURRENT.md の場所だけ。通常タスクには設定できない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件' });
  const c = g.createTask({ targetWeek: W, title: 'C', kind: '通常タスク' });
  assert.throws(() => g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { caseKey: '営業AIメモ' } }] }), /案件キー/);
  assert.throws(() => g.commitWeekBoard(W, { updates: [{ taskId: c.taskId, changes: { caseKey: KA } }] }), /案件キー/);
});
t('持越し：取り込みでも案件キーを引き継ぐ', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex', status: '持越し' });
  g.commitWeekBoard(N, { creates: g.getCarryCandidates(N).candidates });
  const x = g.getTasks(N)[0];
  assert.deepStrictEqual([x.caseKey, x.instructFrom, x.implementTo], [KA, 'Claude', 'Codex']);
});
t('getCaseRoutes：前の週の値と週を返す（見つからない場合は found=false）', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: 'X', kind: 'AI案件', caseKey: KA, instructFrom: 'Claude', implementTo: 'Codex' });
  const r = plain(g.getCaseRoutes(N, [KA, KB]).routes);
  assert.deepStrictEqual(r[KA], { found: true, fromWeek: W, instructFrom: 'Claude', implementTo: 'Codex' });
  assert.deepStrictEqual(r[KB], { found: false });
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
