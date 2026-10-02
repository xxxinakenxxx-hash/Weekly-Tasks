// 朝ブリーフ（IS-03）のサーバー処理テスト：node tests/brief.test.js
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const D = '2026-10-02';
const brief = () => ({ date: D, oneLine: '移動の多い一日。', flow: ['09:00 全体朝礼', '14:30 移動（本社→福岡）'],
  priorities: ['関東販売 営業AIメモの閲覧権限設定'], concerns: ['要確認：サンプル持参はTEST表記'], done: ['勤怠の確認・月次提出'], carryover: ['AIレポート進捗確認シートへのコメント（未着手）'] });

t('保存前は brief が null', () => {
  const g = load(); g.setupSheets();
  const r = g.getMorningBrief(D);
  assert.strictEqual(r.brief, null); assert.strictEqual(r.date, D);
});
t('保存→再読込で全項目が一致', () => {
  const g = load(); g.setupSheets();
  const r = g.saveMorningBrief(brief());
  const b = g.getMorningBrief(D).brief;
  assert.strictEqual(b.oneLine, '移動の多い一日。');
  assert.deepStrictEqual([...b.flow], ['09:00 全体朝礼', '14:30 移動（本社→福岡）']);
  assert.deepStrictEqual([...b.priorities], ['関東販売 営業AIメモの閲覧権限設定']);
  assert.deepStrictEqual([...b.concerns], ['要確認：サンプル持参はTEST表記']);
  assert.deepStrictEqual([...b.done], ['勤怠の確認・月次提出']);
  assert.deepStrictEqual([...b.carryover], ['AIレポート進捗確認シートへのコメント（未着手）']);
  assert.ok(r.brief.savedAt);
});
t('シートが無くても初回保存で作成し、既存シートは変更しない', () => {
  const g = load(); g.setupSheets();
  delete g.__sheets['朝ブリーフ'];
  g.__sheets['シート1'].data = [['既存']];
  g.saveMorningBrief(brief());
  assert.ok(g.__sheets['朝ブリーフ']);
  assert.deepStrictEqual(g.__sheets['シート1'].data, [['既存']]);
  assert.strictEqual(g.getTasks().length, 0);
});
t('同じ日付の再保存は追記し、表示は最新（既存行は上書きしない）', () => {
  const g = load(); g.setupSheets();
  g.saveMorningBrief(brief());
  g.saveMorningBrief(Object.assign(brief(), { oneLine: '再生成版' }));
  assert.strictEqual(g.__sheets['朝ブリーフ'].api.getLastRow(), 3);
  assert.strictEqual(g.getMorningBrief(D).brief.oneLine, '再生成版');
});
t('別の日付は混ざらない', () => {
  const g = load(); g.setupSheets();
  g.saveMorningBrief(brief());
  assert.strictEqual(g.getMorningBrief('2026-10-01').brief, null);
});
t('項目内の改行は1行にまとめて保存する（行区切りが崩れない）', () => {
  const g = load(); g.setupSheets();
  g.saveMorningBrief(Object.assign(brief(), { flow: ['09:00 朝礼\n（本社）'] }));
  assert.deepStrictEqual([...g.getMorningBrief(D).brief.flow], ['09:00 朝礼 （本社）']);
});
t('不正な入力は保存しない', () => {
  const g = load(); g.setupSheets();
  [{ date: '10/2' }, { oneLine: '' }, { flow: '文字列' }, { concerns: [1] }].forEach(bad => {
    assert.throws(() => g.saveMorningBrief(Object.assign(brief(), bad)), Error, JSON.stringify(bad));
  });
  assert.strictEqual(g.__sheets['朝ブリーフ'].api.getLastRow(), 1);
});
t('存在しない日付はエラー', () => {
  const g = load(); g.setupSheets();
  assert.throws(() => g.getMorningBrief('2026-02-30'), /日付/);
});
t('朝ブリーフの保存はタスク・履歴を変更しない', () => {
  const g = load(); g.setupSheets();
  g.createTask({ targetWeek: '2026-09-28', title: 'A', kind: '通常タスク' });
  const before = JSON.stringify([g.getTasks(), g.getHistory()]);
  g.saveMorningBrief(brief());
  assert.strictEqual(JSON.stringify([g.getTasks(), g.getHistory()]), before);
});
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
