// 追加実装 週間入口拡充 項目3「今週やること」欄のテスト：node tests/weekplan.test.js
const assert = require('assert');
const fs = require('fs'), path = require('path');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const W = '2026-10-26', N = '2026-11-02';
function setup() { const g = load(); g.setupSheets(); return g; }

t('列：23列目「今週やること」（末尾に1列だけ追加。入力規則は付けない）', () => {
  const g = setup();
  const h = g.__sheets['タスク'].data[0];
  assert.strictEqual(h.length, 23);
  assert.strictEqual(h[22], '今週やること');
  assert.strictEqual(JSON.stringify(h.slice(0, 22)), JSON.stringify(g.headersOf_(g.SHEETS.TASKS).slice(0, 22)));
  assert.ok(!g.__sheets['タスク'].validations[23]);
});
t('既存の22列のシート：読み書き時に23列目の見出しだけを足し、既存の行・値は変えず、履歴も増えない', () => {
  const g = setup();
  const sh = g.__sheets['タスク'];
  const h22 = g.headersOf_(g.SHEETS.TASKS).slice(0, 22);
  const row = ['T-1', W, '既存タスク', '通常タスク', '月,火', '進行中', 2, true, '結果', 'メモ', '申し送り', '', '', '', '', '', '', '', '', '', '', ''];
  sh.data = [h22.slice(), row.slice()];
  const before = JSON.stringify(sh.data[1]);
  const x = g.getTasks(W)[0];
  assert.strictEqual(sh.data[0].length, 23);
  assert.strictEqual(sh.data[0][22], '今週やること');
  assert.strictEqual(JSON.stringify(sh.data[1].slice(0, 22)), JSON.stringify(row));
  assert.strictEqual(x.weekPlan, '');
  assert.deepStrictEqual([x.title, x.day, x.status, x.result, x.memo, x.handover], ['既存タスク', '月,火', '進行中', '結果', 'メモ', '申し送り']);
  assert.strictEqual(g.getHistory().length, 0);
  assert.ok(before);
});
t('候補（未保存）で入力した今週やることが、採用・確定で一緒に保存され、再読込しても残る（Sheetsの23列目）', () => {
  const g = setup();
  const res = g.commitWeekBoard(W, { creates: [
    { title: '候補A', kind: '通常タスク', day: '火', weekPlan: '見積を作って送る' },
    { title: '候補B', kind: '通常タスク', day: '' }] });
  const a = res.tasks.filter(x => x.title === '候補A')[0], b = res.tasks.filter(x => x.title === '候補B')[0];
  assert.strictEqual(a.weekPlan, '見積を作って送る');
  assert.strictEqual(b.weekPlan, '');
  const again = g.getWeekBoard(W).tasks.filter(x => x.title === '候補A')[0];
  assert.strictEqual(again.weekPlan, '見積を作って送る');
  const row = g.__sheets['タスク'].data.find(r => r[0] === a.taskId);
  assert.strictEqual(row[22], '見積を作って送る');
});
t('保存済みカードでも編集できる。変更は履歴に「修正／今週やること」で残り、他の列は変わらない', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: '保存済み', kind: '通常タスク', memo: '元のメモ', priority: 1 });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { weekPlan: '月曜に資料集め' } }] });
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { weekPlan: '月曜に資料集め、水曜に清書' } }] });
  const x = g.getTasks(W)[0];
  assert.deepStrictEqual([x.weekPlan, x.memo, x.priority, x.status], ['月曜に資料集め、水曜に清書', '元のメモ', 1, '未着手']);
  const h = g.getHistory(a.taskId).slice(1).map(r => [r.op, r.field, r.before, r.after]);
  assert.deepStrictEqual(h, [['修正', '今週やること', '', '月曜に資料集め'], ['修正', '今週やること', '月曜に資料集め', '月曜に資料集め、水曜に清書']]);
  g.commitWeekBoard(W, { updates: [{ taskId: a.taskId, changes: { weekPlan: '' } }] });
  assert.strictEqual(g.getTasks(W)[0].weekPlan, '');
});
t('AI案件にも通常タスクにも入力できる', () => {
  const g = setup();
  const res = g.commitWeekBoard(W, { creates: [{ title: 'AI案件X', kind: 'AI案件', weekPlan: 'IS-02 の続き' }, { title: '通常Y', kind: '通常タスク', weekPlan: '電話' }] });
  assert.deepStrictEqual(res.tasks.map(x => x.weekPlan), ['IS-02 の続き', '電話']);
});
t('「分析結果で更新」（週間分析の読み込み直し）は今週やることを変えない（ユーザー記入専用）', () => {
  const g = setup();
  const a = g.createTask({ targetWeek: W, title: 'AI案件X', kind: 'AI案件', aiPosition: 'P1', weekPlan: '自分で書いた内容' });
  g.commitWeekBoard(W, { refreshes: [{ taskId: a.taskId, changes: { aiPosition: 'P2', weekPlan: 'AIが書こうとした内容' } }] });
  const x = g.getTasks(W)[0];
  assert.strictEqual(x.aiPosition, 'P2');
  assert.strictEqual(x.weekPlan, '自分で書いた内容');
});
t('前週の持越し・次週候補の取り込みでは、今週やることを引き継がない（今週の作業内容のため）', () => {
  const g = setup();
  g.createTask({ targetWeek: W, title: '持越し元', kind: '通常タスク', status: '持越し', weekPlan: '先週の作業内容' });
  const c = g.getCarryCandidates(N).candidates[0];
  assert.strictEqual(c.title, '持越し元');
  assert.ok(!c.weekPlan);
  const res = g.commitWeekBoard(N, { creates: [c] });
  assert.strictEqual(res.tasks[0].weekPlan, '');
});
t('週間分析JSONの項目構成は変えない（今週やることはJSONの項目ではない）。画面の読み込み検証にも追加していない', () => {
  const w = read('src/weekly.html');
  const parse = w.slice(w.indexOf('function parseHandoff'), w.indexOf('function importAnalysis'));
  assert.ok(!parse.includes('今週やること') && !parse.includes('weekPlan'));
  const wa = read('docs/prompts/project_weekly_analysis.md');
  assert.ok(!wa.includes('今週やること'));
  assert.ok(!read('docs/HANDOFF_FORMAT.md').includes('今週やること'));
});
t('週間画面：「詳細・編集」に欄（候補でも出る）。カード表面は入力があるときだけ表示。確定の保存対象に含まれる', () => {
  const w = read('src/weekly.html');
  assert.ok(w.includes("'weekPlan'];") && /EDIT_KEYS = \[[^\]]*'weekPlan'/.test(w));
  assert.ok(w.includes("wta.setAttribute('aria-label', '今週やること')"));
  assert.ok(w.includes("if (String(t.weekPlan || '').trim()) {"));   // 空なら何も出さない
  assert.ok(w.includes("weekPlan: c.weekPlan || ''"));              // 候補の採用で一緒に送る
  // 欄は isCandidate で絞っていない（候補でも入力できる）
  const i = w.indexOf("var wl = el('label', 'wk-record-field wk-weekplan')");
  assert.ok(i > 0 && !w.slice(i - 200, i).includes('isCandidate'));
});
t('朝ブリーフ画面：同じタスクのカードに表示する。読み取りのみ（保存の対象にしない）', () => {
  const b = read('src/brief.html');
  assert.ok(b.includes("String(t.weekPlan || '').trim()") && b.includes("'今週やること：'"));
  const fieldsDef = b.match(/\[\['result', '実施結果'\], \['memo', 'メモ'\], \['handover', '次回申し送り'\]\]/);
  assert.ok(fieldsDef);                       // 朝ブリーフで編集できる欄は従来の3つのまま
  assert.ok(!/fields\[.weekPlan/.test(b) && !b.includes("['weekPlan'"));
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
