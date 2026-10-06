// 追加実装 v1.1（複数日配置・日次AI現在地連携）のサーバー処理テスト：node tests/multiday_ai.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-10-05', P = '2026-09-28';
function setup() { const g = load(); g.setupSheets(); return g; }
const brief = (date, ai) => ({ date, oneLine: '一言', flow: [], priorities: [], concerns: [], done: [], carryover: [], aiPositions: ai });
const ok = (taskId, position, at) => ({ taskId, title: 'X', result: '確認済み', position, at: at || '2026-10-06 07:30' });

// ---- 複数曜日 ----
t('複数曜日：月・火・水に配置しても1行・1タスクIDのまま', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'AI', kind: 'AI案件' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { day: '月,火,水' } }] });
  const rows = g.__sheets['タスク'].data.filter(r => r[0] === a.taskId);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(g.getTasks(W).length, 1);
  assert.strictEqual(g.getTasks(W)[0].day, '月,火,水');
});
t('複数曜日：順序は月→金に揃え、重複を除く（配列・「、」区切りも受け付ける）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク', day: ['水', '月', '水'] });
  assert.strictEqual(g.getTasks(W)[0].day, '月,水');
  g.updateTask(a.taskId, { day: '金、火' });
  assert.strictEqual(g.getTasks(W)[0].day, '火,金');
});
t('複数曜日：月〜金以外を含む値は拒否し、何も書かない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク', day: '月' });
  assert.throws(() => g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { day: '月,土' } }] }), /曜日/);
  assert.strictEqual(g.getTasks(W)[0].day, '月');
  assert.strictEqual(g.getHistory(a.taskId).length, 1);
});
t('複数曜日：変更前後が履歴に残る。空にすると未配置', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク', day: '月' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { day: '月,火' } }] });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { day: '' } }] });
  assert.deepStrictEqual(g.getHistory(a.taskId).slice(1).map(h => [h.field, h.before, h.after]), [['曜日', '月', '月,火'], ['曜日', '月,火', '']]);
  assert.strictEqual(g.getTasks(W)[0].day, '');
});
t('複数曜日：既存の単一曜日データはそのまま有効で、他項目の更新で書き換わらない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'A', kind: '通常タスク', day: '木' });
  g.updateTask(a.taskId, { status: '進行中' });
  assert.strictEqual(g.getTasks(W)[0].day, '木');
  assert.deepStrictEqual(g.getHistory(a.taskId).map(h => h.field), ['', '状態']);
});
t('複数曜日：「曜日」列の入力規則を、値を変えずに複数曜日の一覧へ更新する', () => {
  const g = load();
  g.setupSheets();
  const sh = g.__sheets['タスク'];
  sh.validations[5] = { list: ['月', '火', '水', '木', '金'], allowInvalid: false };
  sh.data.push(['T-1', W, '旧', '通常タスク', '木', '未着手', '', false, '', '', '', '', '', '', '']);
  const before = JSON.stringify(sh.data);
  g.setupSheets();
  assert.strictEqual(JSON.stringify(sh.data), before);
  const list = [...sh.validations[5].list];
  assert.strictEqual(list.length, 31);
  assert.ok(list.includes('月') && list.includes('月,火,水,木,金') && list.includes('火,金'));
});
t('複数曜日：週間タスクJSONの候補（配列の曜日）を1件として保存できる', () => {
  const g = setup();
  g.commitWeekBoard(W, { creates: [{ title: 'AI', kind: 'AI案件', day: ['月', '水'] }] });
  assert.deepStrictEqual(g.getTasks(W).map(x => x.day), ['月,水']);
});
t('複数曜日：持越しの取り込みは未配置で作る（曜日は引き継がない、既存どおり）', () => {
  const g = setup();
  g.createTask({ targetWeek: P, title: '持越', kind: '通常タスク', day: '月,火', status: '持越し' });
  g.commitWeekBoard(W, { creates: g.getCarryCandidates(W).candidates });
  assert.strictEqual(g.getTasks(W)[0].day, '');
});

// ---- 日次AI現在地の同期 ----
t('同期：確認済み・taskId一致・当日取得の現在地だけをAI案件現在地へ同期し、履歴を残す', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: '営業AIメモ', kind: 'AI案件', aiPosition: 'P2-08 途中', day: '月,火,水' });
  const r = g.saveMorningBrief(brief('2026-10-06', [ok(a.taskId, 'P2-08 §14-1 完了、§14-2 着手')]));
  assert.strictEqual(g.getTasks(W)[0].aiPosition, 'P2-08 §14-1 完了、§14-2 着手');
  const h = g.getHistory(a.taskId).slice(-1)[0];
  assert.deepStrictEqual([h.op, h.field, h.before, h.after], ['修正', 'AI案件現在地', 'P2-08 途中', 'P2-08 §14-1 完了、§14-2 着手']);
  assert.deepStrictEqual([...r.aiSync.synced.map(x => x.taskId)], [a.taskId]);
  assert.strictEqual(g.getTasks().length, 1);
});
t('同期：要確認・不一致・取得失敗・チャット未確認は上書きしない（前回の確認済み現在地を保持）', () => {
  const g = setup();
  const ids = ['要確認', '不一致', '取得失敗', 'チャット未確認'].map((k, i) => g.createTask({ targetWeek: W, title: 'AI' + i, kind: 'AI案件', aiPosition: '前回' + i }).taskId);
  const r = g.saveMorningBrief(brief('2026-10-06', ['要確認', '不一致', '取得失敗', 'チャット未確認'].map((k, i) => ({ taskId: ids[i], title: 'AI' + i, result: k, position: '新しい値', at: '2026-10-06 07:30' }))));
  assert.deepStrictEqual(g.getTasks(W).map(x => x.aiPosition), ['前回0', '前回1', '前回2', '前回3']);
  assert.strictEqual(r.aiSync.skipped.length, 4);
  assert.ok(ids.every(id => g.getHistory(id).length === 1));
});
t('同期：taskIdがない・一致しない・別の週・AI案件以外は同期しない（タスク名では突き合わせない）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: '機械販売事例アプリ', kind: 'AI案件', aiPosition: '前回' });
  const prev = g.createTask({ targetWeek: P, title: '機械販売事例まとめアプリ', kind: 'AI案件', aiPosition: '前週' });
  const n = g.createTask({ targetWeek: W, title: '通常', kind: '通常タスク' });
  const r = g.saveMorningBrief(brief('2026-10-06', [
    { taskId: '', title: '機械販売事例アプリ', result: '確認済み', position: '名前だけ', at: '2026-10-06 07:30' },
    ok('T-none', '存在しない'), ok(prev.taskId, '前週の行'), ok(n.taskId, '通常タスク')]));
  assert.strictEqual(g.getTasks(W).find(x => x.taskId === a.taskId).aiPosition, '前回');
  assert.strictEqual(g.getTasks(P)[0].aiPosition, '前週');
  assert.strictEqual(r.aiSync.synced.length, 0);
  assert.strictEqual(r.aiSync.skipped.length, 4);
});
t('同期：現在地が前回と同じなら書き換えず、履歴も増やさない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'AI', kind: 'AI案件', aiPosition: '同じ' });
  const r = g.saveMorningBrief(brief('2026-10-06', [ok(a.taskId, '同じ')]));
  assert.strictEqual(g.getHistory(a.taskId).length, 1);
  assert.deepStrictEqual([...r.aiSync.unchanged.map(x => x.taskId)], [a.taskId]);
});
t('同期：取得日時が当日でない（古い日次ファイル）場合は同期しない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'AI', kind: 'AI案件', aiPosition: '前回' });
  const r = g.saveMorningBrief(brief('2026-10-06', [ok(a.taskId, '古い', '2026-10-05 07:30')]));
  assert.strictEqual(g.getTasks(W)[0].aiPosition, '前回');
  assert.ok(/当日ではない/.test(r.aiSync.skipped[0].reason));
});
t('同期：同じtaskIdが重複したら1件目だけ', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'AI', kind: 'AI案件', aiPosition: '前回' });
  g.saveMorningBrief(brief('2026-10-06', [ok(a.taskId, '1件目'), ok(a.taskId, '2件目')]));
  assert.strictEqual(g.getTasks(W)[0].aiPosition, '1件目');
});
t('同期：形式違い（取得結果の値・確認済みで現在地なし）は朝ブリーフも保存しない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'AI', kind: 'AI案件', aiPosition: '前回' });
  assert.throws(() => g.saveMorningBrief(brief('2026-10-06', [{ taskId: a.taskId, result: '完了', position: 'x' }])), /取得結果/);
  assert.throws(() => g.saveMorningBrief(brief('2026-10-06', [{ taskId: a.taskId, result: '確認済み', position: '', at: '2026-10-06 07:30' }])), /現在地/);
  assert.strictEqual(g.getMorningBrief('2026-10-06').brief, null);
  assert.strictEqual(g.getTasks(W)[0].aiPosition, '前回');
});
t('同期：AI案件現在地は「朝ブリーフ」シートに保存しない（8列のまま）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'AI', kind: 'AI案件' });
  g.saveMorningBrief(brief('2026-10-06', [ok(a.taskId, '新')]));
  const sh = g.__sheets['朝ブリーフ'];
  assert.strictEqual(sh.data[0].filter(x => x !== '').length, 8);
  assert.ok(!JSON.stringify(sh.data[1]).includes('新'));
});
t('同期：AI案件現在地なしの従来の朝ブリーフも保存できる', () => {
  const g = setup();
  const b = brief('2026-10-06'); delete b.aiPositions;
  const r = g.saveMorningBrief(b);
  assert.strictEqual(r.brief.oneLine, '一言');
  assert.deepStrictEqual([r.aiSync.synced.length, r.aiSync.skipped.length], [0, 0]);
});
t('一連：月・火・水に配置したAI案件が、月曜の進捗を火曜朝に、火曜の進捗を水曜朝に、同じ1行の現在地として引き継ぐ', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: '営業AIメモ', kind: 'AI案件', aiPosition: '月曜朝の現在地' });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { day: '月,火,水' } }] });
  g.saveMorningBrief(brief('2026-10-06', [ok(a.taskId, '火曜朝：月曜の進捗を反映', '2026-10-06 07:30')]));
  assert.strictEqual(g.getWeekBoard(W).tasks[0].aiPosition, '火曜朝：月曜の進捗を反映');
  g.saveMorningBrief(brief('2026-10-07', [{ taskId: a.taskId, title: '営業AIメモ', result: '取得失敗', at: '2026-10-07 07:30' }]));
  assert.strictEqual(g.getWeekBoard(W).tasks[0].aiPosition, '火曜朝：月曜の進捗を反映');
  g.saveMorningBrief(brief('2026-10-08', [ok(a.taskId, '木曜朝：水曜の進捗を反映', '2026-10-08 07:30')]));
  const ts = g.getTasks(W);
  assert.deepStrictEqual([ts.length, ts[0].day, ts[0].aiPosition], [1, '月,火,水', '木曜朝：水曜の進捗を反映']);
  assert.deepStrictEqual(g.getHistory(a.taskId).filter(h => h.field === 'AI案件現在地').map(h => h.after), ['火曜朝：月曜の進捗を反映', '木曜朝：水曜の進捗を反映']);
});
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
