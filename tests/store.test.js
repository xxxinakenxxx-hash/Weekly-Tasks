// 正データ（状態5値・履歴）の保存／再読込テスト：node tests/store.test.js
const assert = require('assert');
const fs = require('fs'), path = require('path');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }

t('setupSheets：タスク・履歴シートを作成し、既存シート1は変更しない', () => {
  const g = load();
  g.__sheets['シート1'].data = [['既存']];
  const r = g.setupSheets();
  assert.deepStrictEqual([...r.created], ['タスク', '履歴']);
  assert.deepStrictEqual(g.__sheets['シート1'].data, [['既存']]);
  assert.strictEqual(g.openedId, '1tk1ZaiM1JqPgw9ENAJ8xJN-zT8k4qKYmwroUvE4b1nE');
  assert.ok(r.schema.every(s => s.ok));
});
t('setupSheets：2回実行しても既存データを消さない', () => {
  const g = load(); g.setupSheets();
  g.createTask({ targetWeek: '2026-10-05', title: 'A', kind: '通常タスク' });
  const r = g.setupSheets();
  assert.strictEqual(r.created.length, 0);
  assert.strictEqual(g.getTasks().length, 1);
});
t('setupSheets：見出しが違う既存シートは上書きせずエラー', () => {
  const g = load({ existing: ['シート1', 'タスク'] });
  g.__sheets['タスク'].data = [['別の見出し']];
  assert.throws(() => g.setupSheets(), /一致しません/);
  assert.deepStrictEqual(g.__sheets['タスク'].data, [['別の見出し']]);
});
t('見出しがDB_SCHEMA.mdの表と一致', () => {
  const g = load();
  const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'DB_SCHEMA.md'), 'utf8');
  [g.SHEETS.TASKS, g.SHEETS.HISTORY].forEach(def => {
    const sec = (md.split('## シート「' + def.name + '」')[1] || '').split('\n## ')[0];
    assert.ok(sec, 'DB_SCHEMA.mdにシート「' + def.name + '」の節がない');
    const headers = sec.split('\n').filter(l => /^\| \d+ \|/.test(l)).map(l => l.split('|')[2].trim());
    assert.deepStrictEqual(headers, [...g.headersOf_(def)]);
  });
});
t('状態5値をそれぞれ保存→再読込できる', () => {
  const g = load(); g.setupSheets();
  const task = g.createTask({ targetWeek: '2026-10-05', title: 'B', kind: 'AI案件', aiPosition: 'IS-00 途中' });
  g.STATUS_VALUES.forEach(s => {
    g.updateTask(task.taskId, { status: s });
    assert.strictEqual(g.getTasks('2026-10-05')[0].status, s);
  });
});
t('履歴：作成・状態変更・修正が記録され再読込できる', () => {
  const g = load(); g.setupSheets();
  const task = g.createTask({ targetWeek: '2026-10-05', title: 'C', kind: '通常タスク' });
  g.updateTask(task.taskId, { status: '進行中', memo: 'メモ1' });
  const h = g.getHistory(task.taskId);
  assert.deepStrictEqual(h.map(x => x.op), ['作成', '状態変更', '修正']);
  assert.strictEqual(h[1].before, '未着手'); assert.strictEqual(h[1].after, '進行中');
  assert.strictEqual(h[2].field, 'メモ'); assert.strictEqual(h[2].after, 'メモ1');
});
t('変更なしの更新では履歴を増やさない', () => {
  const g = load(); g.setupSheets();
  const task = g.createTask({ targetWeek: '2026-10-05', title: 'D', kind: '通常タスク' });
  g.updateTask(task.taskId, { title: 'D' });
  assert.strictEqual(g.getHistory(task.taskId).length, 1);
});
t('全項目を保存→再読込できる', () => {
  const g = load(); g.setupSheets();
  const input = { targetWeek: '2026-10-05', title: 'E', kind: 'AI案件', day: '水', status: '進行中', priority: 2, focus: true,
    result: '結果', memo: 'メモ', handover: '申し送り', exception: '不一致：TASK_CURRENTとDriveが異なる', aiPosition: 'IS-01 開始前' };
  const task = g.createTask(input);
  const got = g.getTasks()[0];
  Object.keys(input).forEach(k => assert.strictEqual(got[k], input[k], k));
  assert.strictEqual(got.taskId, task.taskId);
});
t('不正な値は保存しない（状態・種別・曜日・対象週・優先度・例外情報・AI案件現在地）', () => {
  const g = load(); g.setupSheets();
  const base = { targetWeek: '2026-10-05', title: 'F', kind: '通常タスク' };
  [{ status: '完了済み' }, { kind: 'その他' }, { day: '土' }, { targetWeek: '2026-10-06' }, { targetWeek: '10/5' },
   { priority: 0 }, { priority: 1.5 }, { exception: 'エラー' }, { aiPosition: 'x' }, { title: '' }]
    .forEach(bad => assert.throws(() => g.createTask(Object.assign({}, base, bad)), Error, JSON.stringify(bad)));
  assert.strictEqual(g.getTasks().length, 0);
  assert.strictEqual(g.getHistory().length, 0);
});
t('存在しないタスクID・タスクID変更はエラー', () => {
  const g = load(); g.setupSheets();
  const task = g.createTask({ targetWeek: '2026-10-05', title: 'G', kind: '通常タスク' });
  assert.throws(() => g.updateTask('T-none', { status: '完了' }), /見つかりません/);
  assert.throws(() => g.updateTask(task.taskId, { taskId: 'T-x' }), /変更できません/);
});
t('シート未作成で読み書きするとエラー', () => {
  const g = load();
  assert.throws(() => g.getTasks(), /setupSheets/);
});
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
