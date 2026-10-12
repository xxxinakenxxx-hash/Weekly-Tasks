// 週間分析の読み込み直し（2026-10-12）：今週すでにあるAI案件の行を、分析結果で更新するサーバー処理のテスト：node tests/refresh.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-10-12';
const K = 'C:\\Users\\inamori240\\Documents\\machine-sales-system\\tasks\\TASK_CURRENT.md';
function setup() {
  const g = load(); g.setupSheets();
  const a = g.createTask({ targetWeek: W, title: '機械売上管理システム', kind: 'AI案件', day: '月', aiPosition: '現在工程：工程B（誤り）', exception: '不一致：古い記録', caseKey: K, instructFrom: 'ChatGPT', implementTo: 'Codex', status: '進行中', memo: 'メモ' });
  const n = g.createTask({ targetWeek: W, title: '通常', kind: '通常タスク' });
  return { g, a, n };
}
const row = (g, id) => g.getTasks(W).find(x => x.taskId === id);

t('分析結果で更新：AI案件現在地・例外情報が書き換わり、再読込しても新しい内容のまま', () => {
  const { g, a } = setup();
  const res = g.commitWeekBoard(W, { refreshes: [{ taskId: a.taskId, changes: { aiPosition: '現在工程：PH1-FIX-03B 実画面再確認待ち', exception: '' } }] });
  assert.strictEqual(res.refreshed, 1);
  const x = row(g, a.taskId);
  assert.strictEqual(x.aiPosition, '現在工程：PH1-FIX-03B 実画面再確認待ち');
  assert.strictEqual(x.exception, '');
  assert.strictEqual(g.getWeekBoard(W).tasks.find(y => y.taskId === a.taskId).aiPosition, '現在工程：PH1-FIX-03B 実画面再確認待ち');
});
t('分析結果で更新：ほかの欄（曜日・状態・メモ・指示ルート・案件キー）は変えない。行は増えない', () => {
  const { g, a } = setup();
  const before = g.getTasks(W).length;
  g.commitWeekBoard(W, { refreshes: [{ taskId: a.taskId, changes: { aiPosition: '新', exception: '', day: '金', status: '完了', memo: 'x', title: '別名' } }] });
  const x = row(g, a.taskId);
  assert.deepStrictEqual([x.title, x.day, x.status, x.memo, x.instructFrom, x.implementTo, x.caseKey], ['機械売上管理システム', '月', '進行中', 'メモ', 'ChatGPT', 'Codex', K]);
  assert.strictEqual(g.getTasks(W).length, before);
});
t('分析結果で更新：変更は履歴に「修正」で残る', () => {
  const { g, a } = setup();
  g.commitWeekBoard(W, { refreshes: [{ taskId: a.taskId, changes: { aiPosition: '新', exception: '' } }] });
  const h = g.getHistory(a.taskId).filter(x => x.op === '修正').map(x => x.field);
  assert.ok(h.indexOf('AI案件現在地') >= 0 && h.indexOf('例外情報') >= 0, h.join());
});
t('分析結果で更新：現在地が変わると「現在地確認日時」を空欄にする（日次で未確認になる）。同じなら変えない', () => {
  const { g, a } = setup();
  g.updateTask(a.taskId, { aiConfirmedAt: '2026-10-12 06:20' });
  g.commitWeekBoard(W, { refreshes: [{ taskId: a.taskId, changes: { aiPosition: '現在工程：工程B（誤り）', exception: '' } }] });
  assert.strictEqual(String(row(g, a.taskId).aiConfirmedAt), '2026-10-12 06:20');
  g.commitWeekBoard(W, { refreshes: [{ taskId: a.taskId, changes: { aiPosition: '新しい現在地' } }] });
  assert.strictEqual(String(row(g, a.taskId).aiConfirmedAt), '');
});
t('分析結果で更新：不一致・チャット未確認は確認しないと保存しない（何も書かない）', () => {
  const { g, a } = setup();
  const h0 = g.getHistory(a.taskId).length;
  assert.throws(() => g.commitWeekBoard(W, { refreshes: [{ taskId: a.taskId, changes: { aiPosition: '新', exception: 'チャット未確認：x' } }] }), /確認してから/);
  assert.strictEqual(row(g, a.taskId).aiPosition, '現在工程：工程B（誤り）');
  assert.strictEqual(g.getHistory(a.taskId).length, h0);
  g.commitWeekBoard(W, { refreshes: [{ taskId: a.taskId, changes: { aiPosition: '新', exception: 'チャット未確認：x' }, exceptionConfirmed: true }] });
  assert.strictEqual(row(g, a.taskId).exception, 'チャット未確認：x');
});
t('分析結果で更新：AI案件以外・他の週のタスクは更新しない', () => {
  const { g, n } = setup();
  assert.throws(() => g.commitWeekBoard(W, { refreshes: [{ taskId: n.taskId, changes: { exception: '' } }] }), /AI案件だけ/);
  const o = g.createTask({ targetWeek: '2026-10-05', title: '前週AI', kind: 'AI案件' });
  assert.throws(() => g.commitWeekBoard(W, { refreshes: [{ taskId: o.taskId, changes: { aiPosition: 'x' } }] }), /対象週のタスクではありません/);
});
t('分析結果で更新と画面での変更・候補の採用を1回で保存できる（画面での変更が優先）', () => {
  const { g, a } = setup();
  const res = g.commitWeekBoard(W, {
    refreshes: [{ taskId: a.taskId, changes: { aiPosition: '新', exception: '要確認：分析' } }],
    updates: [{ taskId: a.taskId, changes: { status: '完了', exception: '' } }],
    creates: [{ title: '新しい案件', kind: '通常タスク' }]
  });
  const x = row(g, a.taskId);
  assert.deepStrictEqual([x.aiPosition, x.status, x.exception], ['新', '完了', '']);
  assert.strictEqual(res.created, 1);
  assert.strictEqual(g.getTasks(W).length, 3);
});
t('画面での変更では、従来どおりAI案件現在地は書き換えない', () => {
  const { g, a } = setup();
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { aiPosition: '画面から', memo: 'm2' } }] });
  assert.strictEqual(row(g, a.taskId).aiPosition, '現在工程：工程B（誤り）');
  assert.strictEqual(row(g, a.taskId).memo, 'm2');
});
t('分析結果で更新：案件キーが今週の別のAI案件と重なる場合は保存しない', () => {
  const { g, a } = setup();
  const b = g.createTask({ targetWeek: W, title: '別AI', kind: 'AI案件', caseKey: 'C:\\x\\TASK_CURRENT.md' });
  assert.throws(() => g.commitWeekBoard(W, { refreshes: [{ taskId: b.taskId, changes: { caseKey: K } }] }), /同じ案件キー/);
});
// ---- 2026-10-12：週間分析の見立て・コーションを保存し、再読込しても消えない ----
t('見立て・コーション：確定して保存で「週間分析」シートに残り、週間ボードの読み込みで返る', () => {
  const { g } = setup();
  assert.strictEqual(g.getWeekBoard(W).analysis, null);
  const res = g.commitWeekBoard(W, { analysis: { outlook: '今週はIS-06の確認が中心', cautions: ['期限接近：A', '要確認：B'] } });
  assert.strictEqual(res.analysisSaved, true);
  const a = g.getWeekBoard(W).analysis;
  assert.strictEqual(a.outlook, '今週はIS-06の確認が中心');
  assert.strictEqual(JSON.stringify(a.cautions), JSON.stringify(['期限接近：A', '要確認：B']));
  assert.ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(a.savedAt), a.savedAt);
});
t('見立て・コーション：同じ週で保存し直すと新しい内容を返す（行は追記）。別の週には出ない', () => {
  const { g } = setup();
  g.commitWeekBoard(W, { analysis: { outlook: '1回目', cautions: [] } });
  g.commitWeekBoard(W, { analysis: { outlook: '2回目', cautions: ['x'] } });
  assert.strictEqual(g.getWeekBoard(W).analysis.outlook, '2回目');
  assert.strictEqual(g.__sheets['週間分析'].data.length, 3);
  assert.strictEqual(g.getWeekBoard('2026-10-05').analysis, null);
});
t('見立て・コーション：タスクの保存と一緒に1回で保存できる。タスク・履歴の内容は変えない', () => {
  const { g, a } = setup();
  g.commitWeekBoard(W, { analysis: { outlook: 'o', cautions: ['c'] }, refreshes: [{ taskId: a.taskId, changes: { aiPosition: '新', exception: '' } }] });
  assert.strictEqual(row(g, a.taskId).aiPosition, '新');
  assert.strictEqual(g.getWeekBoard(W).analysis.outlook, 'o');
});
t('見立て・コーション：形式が違えば何も書かない', () => {
  const { g } = setup();
  assert.throws(() => g.commitWeekBoard(W, { analysis: { outlook: 1, cautions: [] } }), /見立て/);
  assert.throws(() => g.commitWeekBoard(W, { analysis: { outlook: 'o', cautions: 'x' } }), /コーション/);
  assert.strictEqual(g.getWeekBoard(W).analysis, null);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
