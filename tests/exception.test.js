// 例外・不一致対応（IS-05）のサーバー処理テスト：node tests/exception.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-09-28', N = '2026-10-05';
function setup() { const g = load(); g.setupSheets(); return g; }
const TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

t('自動確定しない：不一致・チャット未確認の候補は確認なしでは保存せず、同じ確定の他の候補も書かない', () => {
  const g = setup();
  ['不一致：TASK_CURRENTとDriveの工程が異なる', 'チャット未確認：対応チャットを特定できない'].forEach(ex => {
    assert.throws(() => g.commitWeekBoard(W, { creates: [
      { title: '通常', kind: '通常タスク' },
      { title: 'AI', kind: 'AI案件', exception: ex }
    ] }), /確認してから採用/);
  });
  assert.strictEqual(g.getTasks(W).length, 0);
  assert.strictEqual(g.getHistory().length, 0);
});
t('自動確定しない：複数の例外のうち2つ目に不一致があっても確認を求める', () => {
  const g = setup();
  assert.throws(() => g.commitWeekBoard(W, { creates: [{ title: 'AI', kind: 'AI案件', exception: '要確認：期限不明／不一致：工程が異なる' }] }), /不一致があるため/);
});
t('確認済みの候補は例外情報をそのまま保存する（確認フラグ自体は保存しない）', () => {
  const g = setup();
  g.commitWeekBoard(W, { creates: [{ title: 'AI', kind: 'AI案件', aiPosition: '要確認', exception: '不一致：工程が異なる', exceptionConfirmed: true }] });
  const x = g.getTasks(W)[0];
  assert.strictEqual(x.exception, '不一致：工程が異なる');
  assert.strictEqual(x.exceptionConfirmed, undefined);
});
t('要確認・取得失敗だけの候補は、確認チェックなしで保存できる（例外情報は保持）', () => {
  const g = setup();
  g.commitWeekBoard(W, { creates: [
    { title: 'A', kind: '通常タスク', exception: '要確認：期限・担当が不明' },
    { title: 'B', kind: '通常タスク', exception: '取得失敗：議事録を読めなかった' }
  ] });
  assert.deepStrictEqual(g.getTasks(W).map(x => x.exception), ['要確認：期限・担当が不明', '取得失敗：議事録を読めなかった']);
});
t('持越し候補に不一致があれば、翌週への取り込みでも確認を求める', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'AI', kind: 'AI案件', exception: '不一致：x' });
  g.updateTask(a.taskId, { status: '持越し' });
  const r = g.getCarryCandidates(N);
  assert.throws(() => g.commitWeekBoard(N, { creates: r.candidates }), /確認してから採用/);
  g.commitWeekBoard(N, { creates: [Object.assign({}, r.candidates[0], { exceptionConfirmed: true })] });
  assert.strictEqual(g.getTasks(N)[0].exception, '不一致：x');
});
t('復旧：例外情報を解消（空欄）すると正常に戻り、変更前の根拠と時点が履歴に残る', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク', exception: '取得失敗：議事録' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { exception: '' } }] });
  assert.strictEqual(g.getTasks(W)[0].exception, '');
  const h = g.getTaskHistory(a.taskId).history;
  const last = h[h.length - 1];
  assert.deepStrictEqual([last.op, last.field, last.before, last.after], ['修正', '例外情報', '取得失敗：議事録', '']);
  assert.ok(TS.test(last.at));
});
t('例外情報の変更：形式違い（区分なし・未定義の区分）は拒否し、何も書かない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク', exception: '要確認：x' });
  ['確認：x', '保留：x', 'x'].forEach(v => {
    assert.throws(() => g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { exception: v } }] }), /例外情報/);
  });
  assert.strictEqual(g.getTasks(W)[0].exception, '要確認：x');
  assert.strictEqual(g.getHistory(a.taskId).length, 1);
});
t('変更履歴：タスク1件分を古い順に、文字列と読込時点つきで返す', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク' });
  g.createTask({ targetWeek: W, title: 'B', kind: '通常タスク' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { status: '進行中', memo: '2026-10-05' } }] });
  const r = g.getTaskHistory(a.taskId);
  assert.deepStrictEqual(r.history.map(h => [h.op, h.field, h.before, h.after]),
    [['作成', '', '', ''], ['状態変更', '状態', '未着手', '進行中'], ['修正', 'メモ', '', '2026-10-05']]);
  assert.ok(r.history.every(h => Object.values(h).every(v => typeof v === 'string')));
  assert.ok(TS.test(r.loadedAt));
  assert.throws(() => g.getTaskHistory(''), /タスクID/);
});
t('時点：週間ボード・確定結果・朝ブリーフは読込時点を返す', () => {
  const g = setup();
  assert.ok(TS.test(g.getWeekBoard(W).loadedAt));
  assert.ok(TS.test(g.commitWeekBoard(W, { creates: [{ title: 'A', kind: '通常タスク' }] }).loadedAt));
  assert.ok(TS.test(g.getMorningBrief('2026-10-02').loadedAt));
});
t('前回値を最新扱いしない：その日の朝ブリーフが無ければ、前日の分を返さない', () => {
  const g = setup();
  g.saveMorningBrief({ date: '2026-10-02', oneLine: '前日', flow: [], priorities: [], concerns: ['取得失敗：資料'], done: [], carryover: [] });
  assert.strictEqual(g.getMorningBrief('2026-10-05').brief, null);
  assert.deepStrictEqual([...g.getMorningBrief('2026-10-02').brief.concerns], ['取得失敗：資料']);
});
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
