// 追加改修④③（案件キーの初期登録・指示ルート継続・AI現在地の区別と案件キーでの日次同期）のサーバー処理テスト：node tests/ai_state.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-10-05', N = '2026-10-12', D = '2026-10-09';
const KA = 'C:\\Users\\inamori240\\Documents\\営業AIメモ\\tasks\\TASK_CURRENT.md';
const KB = 'C:\\Users\\inamori240\\Documents\\管理職AIメモ\\tasks\\TASK_CURRENT.md';
function setup() { const g = load(); g.setupSheets(); return g; }
const plain = x => JSON.parse(JSON.stringify(x));
const brief = (date, ai) => ({ date, oneLine: '一言', flow: [], priorities: [], concerns: [], done: [], carryover: [], aiPositions: ai });
const item = (o) => Object.assign({ taskId: '', caseKey: '', title: 'X', result: '確認済み', position: 'P', at: D + ' 06:15', note: '' }, o);
const task = (g, id) => g.getTasksIncludingDeleted_().find(x => x.taskId === id);

// ---- 日次：案件キーでの突き合わせ ----
t('日次：案件キーで今週のAI案件と突き合わせる（taskIdが無くても、タスク名が違っても）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: '営業AIメモ', kind: 'AI案件', caseKey: KA, aiPosition: '週次の値' });
  const r = g.saveMorningBrief(brief(D, [item({ caseKey: KA, title: '営業AI音声メモ', position: 'P2-08 §14-2 着手' })]));
  const x = task(g, a.taskId);
  assert.deepStrictEqual([x.aiPosition, x.aiConfirmedAt, x.aiLatestAt, x.aiLatestResult, x.aiLatestPosition], ['P2-08 §14-2 着手', D + ' 06:15', D + ' 06:15', '確認済み', 'P2-08 §14-2 着手']);
  assert.strictEqual(r.aiSync.synced[0].taskId, a.taskId);
  assert.strictEqual(r.aiSync.synced[0].title, '営業AIメモ');
});
t('日次：案件キーの比較は「/」「\\」・大文字小文字・前後の空白の違いを同じとみなす', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', caseKey: KA });
  g.saveMorningBrief(brief(D, [item({ caseKey: ' ' + KA.replace(/\\/g, '/').toUpperCase() + ' ', position: 'Q' })]));
  assert.strictEqual(task(g, a.taskId).aiPosition, 'Q');
});
t('日次：案件キーが一致しない・別の週・削除済みの行には書かない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', caseKey: KB, aiPosition: '前' });
  const p = g.createTask({ targetWeek: '2026-09-28', title: 'A', kind: 'AI案件', caseKey: KA, aiPosition: '前週' });
  const d = g.createTask({ targetWeek: W, title: 'D', kind: 'AI案件', caseKey: KA, aiPosition: '削除' });
  g.deleteTask(W, d.taskId);
  const r = g.saveMorningBrief(brief(D, [item({ caseKey: KA, position: '新' })]));
  assert.ok(/一致する行がない/.test(r.aiSync.skipped[0].reason));
  assert.deepStrictEqual([task(g, a.taskId).aiPosition, task(g, p.taskId).aiPosition, task(g, d.taskId).aiPosition], ['前', '前週', '削除']);
});
t('日次：案件キーとtaskIdが別の行を指す場合は、どちらにも書かない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', caseKey: KA, aiPosition: 'a' });
  const b = g.createTask({ targetWeek: W, title: 'B', kind: 'AI案件', caseKey: KB, aiPosition: 'b' });
  const r = g.saveMorningBrief(brief(D, [item({ caseKey: KA, taskId: b.taskId, position: '新' })]));
  assert.ok(/別の行を指している/.test(r.aiSync.skipped[0].reason));
  assert.deepStrictEqual([task(g, a.taskId).aiPosition, task(g, b.taskId).aiPosition], ['a', 'b']);
  assert.strictEqual(g.getHistory(a.taskId).length + g.getHistory(b.taskId).length, 2);
});
t('日次：案件キーとtaskIdが同じ行を指す場合は同期する', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', caseKey: KA });
  g.saveMorningBrief(brief(D, [item({ caseKey: KA, taskId: a.taskId, position: '新' })]));
  assert.strictEqual(task(g, a.taskId).aiPosition, '新');
});
t('日次：案件キーのある手動追加のAI案件は、案件キーで安全に対応するので同期する（案件キーなしは従来どおり対象外）', () => {
  const g = setup();
  const m = g.addManualTask(W, { title: 'M', kind: 'AI案件' }).task;
  const r0 = g.saveMorningBrief(brief(D, [item({ taskId: m.taskId, position: 'X' })]));
  assert.ok(/手動追加/.test(r0.aiSync.skipped[0].reason));
  g.commitWeekBoard(W, { updates: [{ taskId: m.taskId, changes: { caseKey: KA } }] });
  g.saveMorningBrief(brief(D, [item({ caseKey: KA, position: 'Y' })]));
  assert.strictEqual(task(g, m.taskId).aiPosition, 'Y');
});

// ---- 日次：未確認と確認済みの区別 ----
t('区別：確認済み以外は「AI案件現在地」を変えず、最新取得（日時・結果：内容・現在地）として記録する', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', caseKey: KA, aiPosition: '確認済みの前回値' });
  const r = g.saveMorningBrief(brief(D, [item({ caseKey: KA, result: 'チャット未確認', position: 'P2-09 着手（未確認）', note: '対応チャット不明' })]));
  const x = task(g, a.taskId);
  assert.deepStrictEqual([x.aiPosition, x.aiConfirmedAt, x.aiLatestAt, x.aiLatestResult, x.aiLatestPosition], ['確認済みの前回値', '', D + ' 06:15', 'チャット未確認：対応チャット不明', 'P2-09 着手（未確認）']);
  assert.deepStrictEqual(plain(r.aiSync.recorded.map(y => [y.title, y.result])), [['A', 'チャット未確認']]);
  assert.strictEqual(r.aiSync.synced.length, 0);
  assert.ok(!g.getHistory(a.taskId).some(h => h.field === 'AI案件現在地'));
  assert.ok(g.getHistory(a.taskId).some(h => h.field === '最新取得結果' && h.after === 'チャット未確認：対応チャット不明'));
});
t('区別：取得失敗（現在地なし）も最新取得として記録し、前回の確認済み現在地と確認日時は残す', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', caseKey: KA });
  g.saveMorningBrief(brief('2026-10-08', [item({ caseKey: KA, position: '確認済みの値', at: '2026-10-08 06:15' })]));
  g.saveMorningBrief(brief(D, [item({ caseKey: KA, result: '取得失敗', position: '', note: 'TASK_CURRENT.mdを読めない' })]));
  const x = task(g, a.taskId);
  assert.deepStrictEqual([x.aiPosition, x.aiConfirmedAt, x.aiLatestAt, x.aiLatestResult, x.aiLatestPosition], ['確認済みの値', '2026-10-08 06:15', D + ' 06:15', '取得失敗：TASK_CURRENT.mdを読めない', '']);
});
t('区別：古い取得日時（当日でない）は最新取得にも記録しない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', caseKey: KA });
  const r = g.saveMorningBrief(brief(D, [item({ caseKey: KA, at: '2026-10-08 06:15', position: '古い' })]));
  const x = task(g, a.taskId);
  assert.deepStrictEqual([x.aiPosition, x.aiLatestAt], ['', '']);
  assert.ok(/当日ではない/.test(r.aiSync.skipped[0].reason));
});
t('区別：週間分析で作った行・手入力の行は「現在地確認日時」が空欄（日次で未確認）', () => {
  const g = setup();
  g.commitWeekBoard(W, { creates: [{ title: 'A', kind: 'AI案件', aiPosition: '週次の値', caseKey: KA }] });
  const x = g.getTasks(W)[0];
  assert.deepStrictEqual([x.aiPosition, x.aiConfirmedAt, x.aiLatestAt], ['週次の値', '', '']);
});
t('区別：現在地確認日時・最新取得は画面からは変更できない（確定して保存の対象外）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { aiConfirmedAt: '2026-10-09 06:15', aiLatestResult: '確認済み', memo: 'm' } }] });
  const x = task(g, a.taskId);
  assert.deepStrictEqual([x.aiConfirmedAt, x.aiLatestResult, x.memo], ['', '', 'm']);
});
t('区別：通常タスクには現在地確認日時・最新取得を設定できない', () => {
  const g = setup();
  assert.throws(() => g.createTask({ targetWeek: W, title: 'N', kind: '通常タスク', aiLatestResult: '確認済み' }), /AI案件/);
});
t('持越し：取り込みでは、現在地確認日時・最新取得も正データから写す（画面から渡された値は使わない）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: 'AI案件', caseKey: KA, status: '持越し' });
  g.saveMorningBrief(brief(D, [item({ caseKey: KA, position: '確認済みの値' })]));
  const c = g.getCarryCandidates(N).candidates;
  c[0].aiConfirmedAt = '偽'; c[0].aiLatestResult = '偽';
  g.commitWeekBoard(N, { creates: c });
  const n = g.getTasks(N)[0];
  assert.deepStrictEqual([n.aiPosition, n.aiConfirmedAt, n.aiLatestResult, n.caseKey], ['確認済みの値', D + ' 06:15', '確認済み', KA]);
});

// ---- 案件キーの初期登録（1回だけ） ----
function seedBackfillRows(g, opts) {
  opts = opts || {};
  const sh = g.__sheets['タスク'];
  const width = g.SHEETS.TASKS.columns.length;
  g.CASE_KEY_BACKFILL.items.forEach((it, i) => {
    const row = new Array(width).fill('');
    row[0] = it.taskId; row[1] = W; row[2] = opts.title && i === 0 ? opts.title : it.title; row[3] = 'AI案件'; row[5] = '未着手'; row[7] = false;
    if (i === 2) { row[15] = 'ChatGPT'; row[16] = 'Codex'; }
    sh.data.push(row);
  });
}
t('初期登録：計画は読むだけで、4行とも「登録する」（変更前は空欄、変更後は AI案件.md の場所）', () => {
  const g = setup(); seedBackfillRows(g);
  const before = JSON.stringify(g.__sheets['タスク'].data);
  const p = plain(g.getCaseKeyBackfillPlan());
  assert.strictEqual(JSON.stringify(g.__sheets['タスク'].data), before);
  assert.strictEqual(p.canApply, true);
  assert.deepStrictEqual(p.rows.map(r => [r.title, r.state, r.before]), [['機械売上管理システム', 'todo', ''], ['機械販売事例アプリ', 'todo', ''], ['営業AIメモ', 'todo', ''], ['管理職AIメモ', 'todo', '']]);
  assert.ok(p.rows.every(r => /TASK_CURRENT\.md$/.test(r.after)));
});
t('初期登録：実行すると案件キーだけを書き、履歴「修正／案件キー」を残す（指示ルート等は変えない）。再実行しても書かない', () => {
  const g = setup(); seedBackfillRows(g);
  const p = g.applyCaseKeyBackfill(g.CASE_KEY_BACKFILL.id);
  assert.strictEqual(p.written.length, 4);
  assert.strictEqual(p.done, true);
  g.CASE_KEY_BACKFILL.items.forEach(it => {
    const x = task(g, it.taskId);
    assert.strictEqual(x.caseKey, it.caseKey);
    assert.deepStrictEqual(plain(g.getHistory(it.taskId).map(h => [h.op, h.field, h.before, h.after])), [['修正', '案件キー', '', it.caseKey]]);
  });
  assert.deepStrictEqual([task(g, g.CASE_KEY_BACKFILL.items[2].taskId).instructFrom, task(g, g.CASE_KEY_BACKFILL.items[2].taskId).implementTo], ['ChatGPT', 'Codex']);
  const n = g.getHistory().length;
  assert.throws(() => g.applyCaseKeyBackfill(g.CASE_KEY_BACKFILL.id), /何も書き込み/);
  assert.strictEqual(g.getHistory().length, n);
});
t('初期登録：1行でも条件を満たさなければ（タスク名違い）何も書かない', () => {
  const g = setup(); seedBackfillRows(g, { title: '機械売上管理システム（名称変更）' });
  const p = plain(g.getCaseKeyBackfillPlan());
  assert.strictEqual(p.canApply, false);
  assert.ok(/タスク名が一致しない/.test(p.rows[0].reason));
  assert.throws(() => g.applyCaseKeyBackfill(g.CASE_KEY_BACKFILL.id), /何も書き込み/);
  assert.strictEqual(g.getHistory().length, 0);
});
t('初期登録：行が無い・削除済み・別の案件キーが入っている場合も書かない', () => {
  const g = setup();
  assert.strictEqual(plain(g.getCaseKeyBackfillPlan()).canApply, false);
  seedBackfillRows(g);
  g.__sheets['タスク'].data[2][17] = KB;
  const p = plain(g.getCaseKeyBackfillPlan());
  assert.ok(/別の案件キー/.test(p.rows[1].reason));
  assert.strictEqual(p.canApply, false);
});
t('初期登録の後：10/12の週間分析で案件キーつきの新しい行を作ると、営業AIメモの指示ルートを再設定なしで引き継ぐ', () => {
  const g = setup(); seedBackfillRows(g);
  g.applyCaseKeyBackfill(g.CASE_KEY_BACKFILL.id);
  const res = g.commitWeekBoard(N, { creates: [
    { title: '営業AIメモ', kind: 'AI案件', caseKey: KA },
    { title: '管理職AIメモ', kind: 'AI案件', caseKey: KB }] });
  const n = g.getTasks(N);
  assert.deepStrictEqual(plain(n.map(x => [x.title, x.instructFrom, x.implementTo])), [['営業AIメモ', 'ChatGPT', 'Codex'], ['管理職AIメモ', '', '']]);
  assert.strictEqual(res.routeInherited.length, 1);
});
t('初期登録の後：日次の朝ブリーフも案件キーで今週の行に届く（週次・日次で同じ識別）', () => {
  const g = setup(); seedBackfillRows(g);
  g.applyCaseKeyBackfill(g.CASE_KEY_BACKFILL.id);
  g.saveMorningBrief(brief(D, [item({ caseKey: KA, position: 'P2-08 §14-2 着手' })]));
  assert.strictEqual(task(g, g.CASE_KEY_BACKFILL.items[2].taskId).aiPosition, 'P2-08 §14-2 着手');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
