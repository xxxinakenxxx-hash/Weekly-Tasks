// 日次更新・持越し循環（IS-04）のサーバー処理テスト：node tests/carry.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-09-28', N = '2026-10-05';
function setup() { const g = load(); g.setupSheets(); return g; }
// 不一致等の確認チェックを入れた状態（画面で確認した想定）
function confirmAll(cs) { return [...cs].map(c => Object.assign({}, c, { exceptionConfirmed: true })); }
function seed(g) {
  const ids = {};
  [['完了タスク', '完了'], ['進行中タスク', '進行中'], ['未着手タスク', '未着手'], ['次週候補タスク', '次週候補'], ['持越しタスク', '持越し']].forEach(([title, status], i) => {
    const x = g.createTask({ targetWeek: W, title, kind: i === 4 ? 'AI案件' : '通常タスク', priority: i + 1, focus: i === 3, day: '水',
      aiPosition: i === 4 ? 'IS-02 途中' : '', exception: i === 4 ? '不一致：x' : '' });
    g.updateTask(x.taskId, { status, result: '結果' + i, memo: 'メモ' + i, handover: '申し送り' + i });
    ids[title] = x.taskId;
  });
  return ids;
}

t('日次更新：状態・曜日・実施結果・メモ・次回申し送りを保存し、履歴が残る', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { status: '進行中', day: '金', result: '半分済', memo: '電話済', handover: '続きは月曜' } }] });
  const x = g.getWeekBoard(W).tasks[0];
  assert.deepStrictEqual([x.status, x.day, x.result, x.memo, x.handover], ['進行中', '金', '半分済', '電話済', '続きは月曜']);
  assert.deepStrictEqual(g.getHistory(a.taskId).map(h => h.field).slice(1).sort(), ['メモ', '実施結果', '曜日', '次回申し送り', '状態'].sort());
});
t('持越し候補：前週の次週候補・持越しだけを候補として返す（保存しない）', () => {
  const g = setup(); const ids = seed(g);
  const r = g.getCarryCandidates(N);
  assert.strictEqual(r.fromWeek, W);
  assert.deepStrictEqual([...r.candidates].map(c => c.title), ['次週候補タスク', '持越しタスク']);
  assert.strictEqual(g.getTasks(N).length, 0);
  const c = r.candidates[1];
  assert.deepStrictEqual([c.sourceTaskId, c.status, c.day, c.kind, c.priority, c.aiPosition, c.exception, c.handover],
    [ids['持越しタスク'], '未着手', '', 'AI案件', 5, 'IS-02 途中', '不一致：x', '申し送り4']);
});
t('持越し確定：翌週に新しい行を作り、持越し元IDで紐付け、前週の行と履歴は変わらない', () => {
  const g = setup(); const ids = seed(g);
  const before = JSON.stringify([g.getTasks(W), g.getHistory()]);
  const r = g.getCarryCandidates(N);
  g.commitWeekBoard(N, { creates: confirmAll(r.candidates) });
  const next = g.getTasks(N);
  assert.deepStrictEqual(next.map(x => [x.title, x.sourceTaskId, x.status, x.result, x.memo]),
    [['次週候補タスク', ids['次週候補タスク'], '未着手', '', ''], ['持越しタスク', ids['持越しタスク'], '未着手', '', '']]);
  assert.strictEqual(JSON.stringify([g.getTasks(W), g.getHistory().slice(0, JSON.parse(before)[1].length)]), before);
  assert.strictEqual(g.getHistory().length, JSON.parse(before)[1].length + 2);
});
t('二重展開防止：取り込み済みの元は候補に出ず、直接渡してもサーバーが拒否する', () => {
  const g = setup(); seed(g);
  const r = g.getCarryCandidates(N);
  g.commitWeekBoard(N, { creates: confirmAll(r.candidates) });
  const r2 = g.getCarryCandidates(N);
  assert.strictEqual(r2.candidates.length, 0);
  assert.deepStrictEqual([...r2.excluded], ['次週候補タスク', '持越しタスク']);
  assert.throws(() => g.commitWeekBoard(N, { creates: [Object.assign({}, r.candidates[0], { title: '別名で再取込' })] }), /取り込み済み/);
  assert.strictEqual(g.getTasks(N).length, 2);
});
t('持越し候補：翌週に同名タスクがすでにあれば候補から除外する', () => {
  const g = setup(); seed(g);
  g.createTask({ targetWeek: N, title: '持越しタスク', kind: 'AI案件' });
  const r = g.getCarryCandidates(N);
  assert.deepStrictEqual([...r.candidates].map(c => c.title), ['次週候補タスク']);
  assert.deepStrictEqual([...r.excluded], ['持越しタスク']);
});
t('持越し元の検証：存在しないID・同じ週以降のIDは拒否', () => {
  const g = setup();
  const n = g.createTask({ targetWeek: N, title: 'N', kind: '通常タスク' });
  assert.throws(() => g.commitWeekBoard(N, { creates: [{ title: 'X', kind: '通常タスク', sourceTaskId: 'T-none' }] }), /見つかりません/);
  assert.throws(() => g.commitWeekBoard(N, { creates: [{ title: 'Y', kind: '通常タスク', sourceTaskId: n.taskId }] }), /前の週/);
});
t('移行：既存13列の「タスク」シートに14列目の見出しだけを追加し、既存データは変えない', () => {
  const g = load();
  const old = ['タスクID','対象週','タスク名／案件名','種別','曜日','状態','優先度','重点','実施結果','メモ','次回申し送り','例外情報','AI案件現在地'];
  g.setupSheets();
  const sh = g.__sheets['タスク'];
  sh.data = [old.slice(), ['T-1', W, '旧タスク', '通常タスク', '木', '完了', 1, true, '', '', '', '', '']];
  const before = JSON.stringify(sh.data[1]);
  const tasks = g.getTasks(W);
  assert.strictEqual(sh.data[0][13], '持越し元タスクID');
  assert.strictEqual(JSON.stringify(sh.data[1].slice(0, 13)), before);
  assert.strictEqual(tasks[0].title, '旧タスク');
  assert.strictEqual(tasks[0].sourceTaskId, '');
});
t('移行：見出しが13列でも内容が違うシートは変更せずエラー', () => {
  const g = load(); g.setupSheets();
  const sh = g.__sheets['タスク'];
  sh.data = [['別','見','出','し','5','6','7','8','9','10','11','12','13']];
  assert.throws(() => g.getTasks(), /一致しません/);
  assert.strictEqual(sh.data[0].length, 13);
});
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
