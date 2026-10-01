// runIs00SheetTest の動作確認（スタブ上）：node tests/is00test.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let fail = 0;
function t(name, fn) { try { fn(); console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
t('空のシート1だけの状態から試験し、試験行を残さない', () => {
  const g = load();
  const r = g.runIs00SheetTest();
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(r.restored, true);
  assert.deepStrictEqual([...r.sheetsAfter], ['シート1', 'タスク', '履歴']);
  assert.strictEqual(g.__sheets['タスク'].api.getLastRow(), 1);
  assert.strictEqual(g.__sheets['履歴'].api.getLastRow(), 1);
  assert.deepStrictEqual(g.__sheets['シート1'].data, []);
});
t('既存のタスク・履歴行は残す', () => {
  const g = load(); g.setupSheets();
  const keep = g.createTask({ targetWeek: '2026-10-05', title: '既存', kind: '通常タスク' });
  g.runIs00SheetTest();
  assert.deepStrictEqual(g.getTasks().map(x => x.taskId), [keep.taskId]);
  assert.strictEqual(g.getHistory().length, 1);
});
t('見出し不一致の既存シートがあれば失敗し、何も消さない', () => {
  const g = load({ existing: ['シート1', 'タスク'] });
  g.__sheets['タスク'].data = [['別']];
  const r = g.runIs00SheetTest();
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(g.__sheets['タスク'].data, [['別']]);
});
process.exit(fail ? 1 : 0);
