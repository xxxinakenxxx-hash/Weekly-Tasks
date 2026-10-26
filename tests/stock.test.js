// 追加実装 週間入口拡充 項目2 TODOタブ・ストック・Google Tasks取込のテスト：node tests/stock.test.js
// Tasks API（高度なGoogleサービス）は呼び出しを差し替えて検証する。実機確認は受入で行う。
const assert = require('assert');
const fs = require('fs'), path = require('path');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const j = x => JSON.stringify(x);
const W = '2026-10-26';
const todo = () => ({ lists: [{ id: 'L1', title: 'My Tasks', tasks: [
  { id: 'a', title: '歯医者を予約する', status: 'needsAction' },
  { id: 'b', title: '完了済みの項目', status: 'completed' },
  { id: 'c', title: '削除された項目', status: 'needsAction', deleted: true },
  { id: 'd', title: '  ', status: 'needsAction' }] }] });
const stockSheet = g => g.__sheets['ストック'];
const body = g => (stockSheet(g) ? stockSheet(g).data.slice(1) : []);

t('Google Tasks連携：appsscript.json は enabledAdvancedServices に Tasks（v1）だけを追加。oauthScopes は追加しない', () => {
  const m = JSON.parse(read('src/appsscript.json'));
  assert.deepStrictEqual(m.dependencies.enabledAdvancedServices, [{ userSymbol: 'Tasks', serviceId: 'tasks', version: 'v1' }]);
  assert.ok(!('oauthScopes' in m));
  assert.deepStrictEqual([m.timeZone, m.runtimeVersion, m.webapp.executeAs, m.webapp.access], ['Asia/Tokyo', 'V8', 'USER_DEPLOYING', 'MYSELF']);
});
t('TODOタブ：画面は 週間タスク・朝ブリーフ・TODO の3つ。既存の2タブの定義は変わらない', () => {
  const g = load();
  assert.deepStrictEqual(Object.keys(g.VIEWS), ['weekly', 'brief', 'todo']);
  assert.deepStrictEqual([g.VIEWS.weekly.label, g.VIEWS.brief.label, g.VIEWS.todo.label], ['週間タスク', '朝ブリーフ', 'TODO']);
  const ctx = g.initApp_({ parameter: { view: 'todo' } });
  assert.strictEqual(ctx.initialView, 'todo');
  assert.deepStrictEqual(ctx.views.map(v => v.label), ['週間タスク', '朝ブリーフ', 'TODO']);
  assert.strictEqual(g.initApp_({}).initialView, 'weekly');
  assert.strictEqual(g.initApp_({ parameter: { view: 'brief' } }).initialView, 'brief');
});
t('TODOタブ：index.html に section と部品の読み込みがあり、既存2つの section は残っている。ページに入力・追加・一覧がある', () => {
  const idx = read('src/index.html');
  ["include('view_weekly')", "include('view_brief')", "include('view_todo')", "include('todo')", 'data-view="todo"'].forEach(x => assert.ok(idx.includes(x), x));
  const v = read('src/view_todo.html');
  ['id="td-input"', 'id="td-add"', 'id="td-week"', 'id="td-list"', 'id="td-done"', 'id="td-reload"'].forEach(x => assert.ok(v.includes(x), x));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'src/todo.html')));
  // スマホ幅でも使える：固定幅の大きな要素を置かない（既存の wk-* の折り返しと 600px 以下の設定を使う）
  assert.ok(!/width:\s*\d{3,}px/.test(v));
});
t('シートは使うときに作る：TODOを開いても（Tasks未有効・項目なし）ストックのシートは作られない。タスクの列は増えない', () => {
  const g = load(); g.setupSheets();
  const p = g.getStockPage();
  assert.strictEqual(stockSheet(g), undefined);
  assert.strictEqual(p.items.length, 0);
  assert.ok(!g.ALL_SHEETS.some(s => s.name === 'ストック'));
});
t('Tasks連携が無効（未承認）：例外にせず、理由を結果に残す。手入力は使える', () => {
  const g = load(); g.setupSheets();
  const p = g.getStockPage();
  assert.strictEqual(p.todo.result, '取込失敗');
  assert.ok(/高度なGoogleサービス「Tasks」/.test(p.todo.reason));
  const r = g.addStockItem({ content: '手で書いた項目' });
  assert.strictEqual(r.items.length, 1);
});
t('手入力：1行で追加（出どころ＝手入力・状態＝未採用・書いた日＝今日）。見出し6列・状態の入力規則あり', () => {
  const g = load(); g.setupSheets();
  const r = g.addStockItem({ content: '  経費精算を\n出す  ' });
  assert.strictEqual(r.items[0].content, '経費精算を 出す');
  const h = stockSheet(g).data[0];
  assert.strictEqual(j(h), j(['内容', '書いた日', '出どころ', '希望週', '状態', 'ToDo側ID']));
  const row = body(g)[0];
  assert.strictEqual(j([row[0], row[2], row[4], row[5]]), j(['経費精算を 出す', '手入力', '未採用', '']));
  assert.strictEqual(r.items[0].writtenOn, g.currentDate_());
  assert.deepStrictEqual(Array.from(stockSheet(g).validations[5].list), ['未採用', '採用済み', '取り下げ']);
  assert.ok(!stockSheet(g).validations[3]);
});
t('手入力の異常：空の内容・同じ内容の未採用・月曜でない希望週は追加しない', () => {
  const g = load(); g.setupSheets();
  assert.throws(() => g.addStockItem({ content: '   ' }), /内容を入力/);
  g.addStockItem({ content: 'A' });
  assert.throws(() => g.addStockItem({ content: 'A' }), /同じ内容/);
  assert.throws(() => g.addStockItem({ content: 'B', hopeWeek: '2026-10-27' }), /月曜日/);
  assert.strictEqual(body(g).length, 1);
  const ok = g.addStockItem({ content: 'B', hopeWeek: '2026-11-02' });
  assert.strictEqual(ok.items.filter(x => x.content === 'B')[0].hopeWeek, '2026-11-02');
});
t('ToDo取込：未取込の未完了項目だけをストックに合流（出どころ＝カレンダー・未採用・ToDo側ID＝リストID/タスクID）。完了・削除・題名なしは取り込まない', () => {
  const g = load({ todo: todo() }); g.setupSheets();
  const p = g.getStockPage();
  assert.strictEqual(p.todo.result, '取込済み');
  assert.strictEqual(p.todo.added, 1);
  assert.strictEqual(p.items.length, 1);
  const row = body(g)[0];
  assert.strictEqual(j([row[0], row[2], row[4], row[5]]), j(['歯医者を予約する', 'カレンダー', '未採用', 'L1/a']));
  // 完了・削除も取得して注記に使う（showCompleted／showHidden／showDeleted）
  const call = g.__todoCalls.filter(c => c[0] === 'Tasks.list')[0];
  assert.deepStrictEqual([call[2].showCompleted, call[2].showHidden, call[2].showDeleted], [true, true, true]);
});
t('ToDo取込：ToDo側IDで重複を防ぐ（何度開いても・トリガーでも二重に入らない）', () => {
  const g = load({ todo: todo() }); g.setupSheets();
  g.getStockPage(); g.getStockPage(); g.importAnalysisFromDrive();
  assert.strictEqual(body(g).length, 1);
  assert.strictEqual(g.getStockPage().todo.result, '何もしない');
});
t('ToDo側で完了・削除された項目：ストックの状態は変えず、「出どころ」の注記だけで分かる（戻れば注記も戻る）', () => {
  const td = todo();
  const g = load({ todo: td }); g.setupSheets();
  g.getStockPage();
  td.lists[0].tasks[0].status = 'completed';
  let p = g.getStockPage();
  assert.strictEqual(p.items[0].source, 'カレンダー（ToDo側で完了）');
  assert.strictEqual(p.items[0].status, '未採用');
  assert.strictEqual(p.todo.noted, 1);
  td.lists[0].tasks[0].deleted = true;
  assert.strictEqual(g.getStockPage().items[0].source, 'カレンダー（ToDo側で削除）');
  td.lists[0].tasks[0].deleted = false; td.lists[0].tasks[0].status = 'needsAction';
  assert.strictEqual(g.getStockPage().items[0].source, 'カレンダー');
  assert.strictEqual(body(g).length, 1);
});
t('ToDo取込と手入力は共存する。取り下げた項目はToDoが残っていても復活しない（同じIDは再取込しない）', () => {
  const g = load({ todo: todo() }); g.setupSheets();
  g.addStockItem({ content: '手入力の項目' });
  const p = g.getStockPage();
  assert.strictEqual(p.items.length, 2);
  const cal = p.items.filter(x => x.source === 'カレンダー')[0];
  g.setStockStatus(cal.row, cal.content, '取り下げ');
  const q = g.getStockPage();
  assert.strictEqual(q.items.length, 2);
  assert.strictEqual(q.items.filter(x => x.todoId === 'L1/a')[0].status, '取り下げ');
});
t('ToDo取込の失敗：例外にせず理由を残し、ストックの一覧は返す（既存の行は壊さない）', () => {
  const td = todo();
  const g = load({ todo: td }); g.setupSheets();
  g.getStockPage();
  td.error = 'Service invoked too many times';
  const p = g.getStockPage();
  assert.strictEqual(p.todo.result, '取込失敗');
  assert.ok(p.todo.reason.includes('Service invoked too many times'));
  assert.strictEqual(p.items.length, 1);
});
t('既存の1時間おき取込トリガーの中でToDoを合流する。新しいトリガーは作らない（取込トリガーは従来の2本のまま）', () => {
  const g = load({ todo: todo() }); g.setupSheets();
  g.importAnalysisFromDrive();
  assert.strictEqual(body(g).length, 1);
  assert.deepStrictEqual(Array.from(g.IMPORT.TRIGGER_FUNCTIONS), ['importBriefFromDrive', 'importAnalysisFromDrive']);
  g.installImportTriggers();
  assert.strictEqual(g.__triggers.length, 2);
  assert.ok(!/ScriptApp\.newTrigger/.test(read('src/Stock.js')));
  // Tasks未有効のトリガーは週間分析の確認結果を変えない（例外にならない）
  const g2 = load(); g2.setupSheets();
  g2.importAnalysisFromDrive();
  assert.strictEqual(g2.__props['import.todo'] ? JSON.parse(g2.__props['import.todo']).result : '', '取込失敗');
});
t('状態の変更：取り下げ⇔未採用。採用済みは画面から変えない。内容が違う・行がない・不正な状態は拒否', () => {
  const g = load(); g.setupSheets();
  const r = g.addStockItem({ content: 'X' }).items[0];
  assert.strictEqual(g.setStockStatus(r.row, 'X', '取り下げ').items[0].status, '取り下げ');
  assert.strictEqual(g.setStockStatus(r.row, 'X', '未採用').items[0].status, '未採用');
  assert.throws(() => g.setStockStatus(r.row, 'Y', '取り下げ'), /内容が画面の表示と違います/);
  assert.throws(() => g.setStockStatus(99, 'X', '取り下げ'), /行が見つかりません/);
  assert.throws(() => g.setStockStatus(r.row, 'X', '採用済み'), /画面から変えられる状態/);
  stockSheet(g).data[1][4] = '採用済み';
  assert.throws(() => g.setStockStatus(r.row, 'X', '取り下げ'), /採用済みの項目は変更できません/);
});
t('採用済みへの更新：確定して保存の処理内で、採用した候補のタスク名と同じ内容の「未採用」だけを「採用済み」にする', () => {
  const g = load(); g.setupSheets();
  g.addStockItem({ content: '見積書を送る' });
  g.addStockItem({ content: '別件のメモ' });
  g.addStockItem({ content: '取り下げ済みの件' });
  const withdrawn = g.getStockPage().items.filter(x => x.content === '取り下げ済みの件')[0];
  g.setStockStatus(withdrawn.row, withdrawn.content, '取り下げ');
  const res = g.commitWeekBoard(W, { creates: [
    { title: '見積書を送る', kind: '通常タスク', day: '火' },
    { title: '取り下げ済みの件', kind: '通常タスク' },
    { title: 'ストックと無関係', kind: '通常タスク' }] });
  assert.strictEqual(res.stockAdopted, 1);
  const st = g.getStockPage().items;
  const by = c => st.filter(x => x.content === c)[0].status;
  assert.deepStrictEqual([by('見積書を送る'), by('別件のメモ'), by('取り下げ済みの件')], ['採用済み', '未採用', '取り下げ']);
});
t('確定が失敗したら（検証エラー）ストックは変えない。既存タスクの変更だけの確定でも変えない', () => {
  const g = load(); g.setupSheets();
  g.addStockItem({ content: '重複する名前' });
  g.createTask({ targetWeek: W, title: '重複する名前', kind: '通常タスク' });
  assert.throws(() => g.commitWeekBoard(W, { creates: [{ title: '重複する名前', kind: '通常タスク' }] }), /同名/);
  assert.strictEqual(g.getStockPage().items[0].status, '未採用');
  const x = g.getTasks(W)[0];
  const r = g.commitWeekBoard(W, { updates: [{ taskId: x.taskId, changes: { memo: 'm' } }] });
  assert.strictEqual(r.stockAdopted, 0);
  assert.strictEqual(g.getStockPage().items[0].status, '未採用');
});
t('ストックのシートが無くても確定して保存は従来どおり動く（作らない）', () => {
  const g = load(); g.setupSheets();
  const r = g.commitWeekBoard(W, { creates: [{ title: 'ふつうの候補', kind: '通常タスク' }] });
  assert.strictEqual(r.stockAdopted, 0);
  assert.strictEqual(stockSheet(g), undefined);
});
t('ストックの見出しが定義と違えば何も書かない（既存データを壊さない）', () => {
  const g = load({ existing: ['シート1', 'ストック'] }); g.setupSheets();
  stockSheet(g).data = [['違う見出し', 'b'], ['x', 'y']];
  assert.throws(() => g.addStockItem({ content: 'Z' }), /見出し/);
  assert.strictEqual(j(stockSheet(g).data), j([['違う見出し', 'b'], ['x', 'y']]));
});
t('朝ブリーフには混ぜない：ストックを読むのは週次の経路だけ（Brief.js・朝ブリーフ指示文・brief.html に出てこない）', () => {
  ['src/Brief.js', 'src/brief.html', 'src/view_brief.html', 'docs/prompts/project_morning_brief.md'].forEach(f => {
    const s = read(f);
    assert.ok(!s.includes('ストック') && !/STOCK|Stock/.test(s), f);
  });
});
t('週間分析の指示文（付録B）：ストックの未採用を読み、タスク案に含める。ストックの状態は変えない', () => {
  const wa = read('docs/prompts/project_weekly_analysis.md');
  const code = wa.slice(wa.indexOf('```\n') + 4, wa.lastIndexOf('\n```'));
  assert.ok(code.includes('「ストック」シート（状態が「未採用」の行。内容・書いた日・出どころ・希望週。読むだけで変更しない）'));
  assert.ok(code.includes('ストックの「未採用」の行は、すべてタスク案（種別は通常タスク）に含める'));
  assert.ok(code.includes('採用するストックのタスク名は、ストックの「内容」と一字も違わずに書く'));
  assert.ok(code.includes('ストックの状態は変えない'));
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
