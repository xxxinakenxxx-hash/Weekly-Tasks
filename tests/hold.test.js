// 追加改修（状態「保留」の追加）のサーバー処理テスト：node tests/hold.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-10-05', N = '2026-10-12';
function setup() { const g = load(); g.setupSheets(); return g; }
const SIX = ['未着手', '進行中', '完了', '保留', '次週候補', '持越し'];

t('状態は6値（未着手・進行中・完了・保留・次週候補・持越し の順）', () => {
  const g = setup();
  assert.deepStrictEqual([...g.STATUS_VALUES], SIX);
});
t('6状態すべて保存・再読込でき、変更ごとに履歴「状態変更」が残る', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  SIX.slice(1).concat(['未着手']).forEach(s => {
    g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { status: s } }] });
    assert.strictEqual(g.getTasks(W)[0].status, s);
  });
  const h = g.getHistory(a.taskId).filter(x => x.op === '状態変更').map(x => x.before + '→' + x.after);
  assert.deepStrictEqual(h, ['未着手→進行中', '進行中→完了', '完了→保留', '保留→次週候補', '次週候補→持越し', '持越し→未着手']);
});
t('保留：週間画面・朝ブリーフ画面と同じ保存経路（commitWeekBoard）で保存され、再読込しても保留のまま', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク', day: '水' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { status: '保留' } }] });
  assert.strictEqual(g.getWeekBoard(W).tasks[0].status, '保留');
  assert.strictEqual(g.getTasks(W)[0].day, '水');
});
t('6値以外の状態は拒否し、何も書かない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  assert.throws(() => g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { status: '延期' } }] }), /状態/);
  assert.strictEqual(g.getTasks(W)[0].status, '未着手');
  assert.strictEqual(g.getHistory(a.taskId).length, 1);
});
t('入力規則：新しく作る「状態」列は6値', () => {
  const g = setup();
  assert.deepStrictEqual([...g.__sheets['タスク'].validations[6].list], SIX);
});
t('入力規則：既存の5値の規則は、setupSheets で値を変えずに6値へ更新する', () => {
  const g = setup();
  const sh = g.__sheets['タスク'];
  sh.validations[6] = { list: ['未着手', '進行中', '完了', '次週候補', '持越し'], allowInvalid: false };
  sh.data.push(['T-1', W, '旧', '通常タスク', '木', '持越し', '', false, '', '', '', '', '', '', '']);
  const before = JSON.stringify(sh.data);
  g.setupSheets();
  assert.strictEqual(JSON.stringify(sh.data), before);
  assert.deepStrictEqual([...sh.validations[6].list], SIX);
});
t('入力規則：読み書きだけでは変えず、初めて「保留」を保存するときに6値へ更新する', () => {
  const g = setup();
  const sh = g.__sheets['タスク'];
  const old = ['未着手', '進行中', '完了', '次週候補', '持越し'];
  sh.validations[6] = { list: old, allowInvalid: false };
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.updateTask(a.taskId, { status: '進行中' });
  g.getTasks(W);
  assert.deepStrictEqual([...sh.validations[6].list], old);
  g.updateTask(a.taskId, { status: '保留' });
  assert.deepStrictEqual([...sh.validations[6].list], SIX);
  assert.strictEqual(g.getTasks(W)[0].status, '保留');
});
t('入力規則：曜日列など他の列の規則は変えない', () => {
  const g = setup();
  const sh = g.__sheets['タスク'];
  const before = JSON.stringify([sh.validations[4], sh.validations[5]]);
  sh.validations[6] = { list: ['未着手', '進行中', '完了', '次週候補', '持越し'], allowInvalid: false };
  g.setupSheets();
  assert.strictEqual(JSON.stringify([sh.validations[4], sh.validations[5]]), before);
});
t('既存タスクの状態は変えない（setupSheets・他のタスクの保留設定で変わらない）', () => {
  const g = setup();
  const ids = ['未着手', '進行中', '完了', '次週候補', '持越し'].map((s, i) => g.createTask({ targetWeek: W, title: 'T' + i, kind: '通常タスク', status: s }).taskId);
  const h = g.createTask({ targetWeek: W, title: 'H', kind: '通常タスク' });
  g.updateTask(h.taskId, { status: '保留' });
  g.setupSheets();
  assert.deepStrictEqual(ids.map(id => g.getTasks(W).find(x => x.taskId === id).status), ['未着手', '進行中', '完了', '次週候補', '持越し']);
  ids.forEach(id => assert.strictEqual(g.getHistory(id).length, 1));
});
t('翌週：保留は持越し候補に出ない（次週候補・持越しは従来どおり）', () => {
  const g = setup();
  const h = g.createTask({ targetWeek: W, title: '保留のタスク', kind: '通常タスク' });
  g.updateTask(h.taskId, { status: '保留' });
  const c = g.createTask({ targetWeek: W, title: '次週候補のタスク', kind: '通常タスク', status: '次週候補' });
  const k = g.createTask({ targetWeek: W, title: '持越しのタスク', kind: '通常タスク', status: '持越し' });
  const res = g.getCarryCandidates(N);
  assert.deepStrictEqual([...res.candidates.map(x => x.title)].sort(), ['持越しのタスク', '次週候補のタスク'].sort());
  assert.ok(res.excluded.indexOf('保留のタスク') < 0);
});
t('翌週：取り込みを確定しても、元の週の保留タスクの状態・行・履歴は変わらない', () => {
  const g = setup();
  const h = g.createTask({ targetWeek: W, title: '保留のタスク', kind: '通常タスク', day: '金' });
  g.updateTask(h.taskId, { status: '保留', handover: '来月やる' });
  g.createTask({ targetWeek: W, title: '持越しのタスク', kind: '通常タスク', status: '持越し' });
  const histBefore = JSON.stringify(g.getHistory(h.taskId));
  g.commitWeekBoard(N, { creates: g.getCarryCandidates(N).candidates });
  const x = g.getTasks(W).find(t => t.taskId === h.taskId);
  assert.deepStrictEqual([x.status, x.day, x.handover, x.targetWeek], ['保留', '金', '来月やる', W]);
  assert.strictEqual(JSON.stringify(g.getHistory(h.taskId)), histBefore);
  assert.strictEqual(g.getTasks(N).length, 1);
  assert.strictEqual(g.getTasks(N)[0].title, '持越しのタスク');
});
t('翌週：どの取り込みをしても、元の週の保留タスクの状態は自動で変わらない', () => {
  const g = setup();
  const h = g.createTask({ targetWeek: W, title: '保留のタスク', kind: '通常タスク' });
  g.updateTask(h.taskId, { status: '保留' });
  // 画面を通さず持越し元を指定した場合も、元の週の行は変更しない（取り込みは翌週の新しい行）
  g.commitWeekBoard(N, { creates: [{ title: '保留のタスク', kind: '通常タスク', sourceTaskId: h.taskId }] });
  assert.strictEqual(g.getTasks(W)[0].status, '保留');
});
t('保留から再開：ユーザーが状態を変えれば通常どおり扱える（自動では変わらない）', () => {
  const g = setup();
  const h = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.updateTask(h.taskId, { status: '保留' });
  g.getCarryCandidates(N); g.getWeekBoard(N); g.getWeekBoard(W);
  assert.strictEqual(g.getTasks(W)[0].status, '保留');
  g.updateTask(h.taskId, { status: '持越し' });
  assert.strictEqual(g.getCarryCandidates(N).candidates.length, 1);
});
t('手動タスク追加は従来どおり「未着手」で始まる（保留を初期値にしない）', () => {
  const g = setup();
  assert.strictEqual(g.addManualTask(W, { title: 'M', kind: '通常タスク' }).task.status, '未着手');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
