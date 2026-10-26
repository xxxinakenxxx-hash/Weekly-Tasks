// 追加改修 現在地同期改善 項目2：週間タスク画面の案件キー欄（リポジトリ指定入力）のテスト：node tests/casekey_input.test.js
// 画面の関数 normalizeCaseKeyInput を src/weekly.html から取り出して検証する。
const assert = require('assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const weekly = fs.readFileSync(path.join(__dirname, '..', 'src/weekly.html'), 'utf8');
const start = weekly.indexOf("var CASEKEY_OWNER = ");
const end = weekly.indexOf('// 指示ルート（追加改修④）：「指示元 → 実装先」。', start);
assert.ok(start > 0 && end > start, '関数が見つからない');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(weekly.slice(start, end), ctx);
const norm = ctx.normalizeCaseKeyInput;
const GH = r => 'https://github.com/xxxinakenxxx-hash/' + r + '/blob/HEAD/tasks/TASK_CURRENT.md';
const ok = (input, value) => { const r = norm(input); assert.strictEqual(r.ok, true, input + ' → ' + r.reason); assert.strictEqual(r.value, value, input); };
const ng = (input, re) => { const r = norm(input); assert.strictEqual(r.ok, false, input); assert.ok(re.test(r.reason), r.reason); assert.strictEqual(r.value, undefined); };

t('GitHub のリポジトリのアドレス → 所定のキー形（blob/HEAD/tasks/TASK_CURRENT.md）', () => {
  ok('https://github.com/xxxinakenxxx-hash/Aegis-Mesh', GH('Aegis-Mesh'));
  ok('  https://github.com/xxxinakenxxx-hash/Aegis-Mesh  ', GH('Aegis-Mesh'));
  ok('http://github.com/xxxinakenxxx-hash/Aegis-Mesh', GH('Aegis-Mesh'));
  ok('https://www.github.com/xxxinakenxxx-hash/Aegis-Mesh', GH('Aegis-Mesh'));
});
t('末尾の .git・/・/tree/…・/blob/…・?…・#… は許容して整える', () => {
  ok('https://github.com/xxxinakenxxx-hash/Aegis-Mesh.git', GH('Aegis-Mesh'));
  ok('https://github.com/xxxinakenxxx-hash/Aegis-Mesh/', GH('Aegis-Mesh'));
  ok('https://github.com/xxxinakenxxx-hash/Aegis-Mesh/tree/main/docs', GH('Aegis-Mesh'));
  ok('https://github.com/xxxinakenxxx-hash/Aegis-Mesh/tree/claude/foo-bar', GH('Aegis-Mesh'));
  ok('https://github.com/xxxinakenxxx-hash/Aegis-Mesh?tab=readme-ov-file', GH('Aegis-Mesh'));
  ok('git@github.com:xxxinakenxxx-hash/Aegis-Mesh.git', GH('Aegis-Mesh'));
  ok('https://github.com/XXXinakenxxx-hash/Weekly-Tasks.git', GH('Weekly-Tasks'));   // 所有者の大文字小文字は同じとみなし、所定の所有者名で書く
  ok('https://github.com/xxxinakenxxx-hash/AI.memo_2', GH('AI.memo_2'));
});
t('ローカルフォルダの場所 → （フォルダ）\\tasks\\TASK_CURRENT.md', () => {
  const L = 'C:\\Users\\inamori240\\Documents\\Aegis-Mesh\\tasks\\TASK_CURRENT.md';
  ok('C:\\Users\\inamori240\\Documents\\Aegis-Mesh', L);
  ok('C:\\Users\\inamori240\\Documents\\Aegis-Mesh\\', L);
  ok('"C:\\Users\\inamori240\\Documents\\Aegis-Mesh"', L);
  ok('C:/Users/inamori240/Documents/Aegis-Mesh', L);
  ok('C:\\Users\\inamori240\\Documents\\Aegis-Mesh\\tasks', L);
  ok('C:\\Users\\inamori240\\Documents\\機械販売事例アプリ', 'C:\\Users\\inamori240\\Documents\\機械販売事例アプリ\\tasks\\TASK_CURRENT.md');
});
t('すでに正しい形（TASK_CURRENT.md で終わる値）は変えない', () => {
  [GH('Aegis-Mesh'), 'C:\\Users\\inamori240\\Documents\\営業AIメモ\\tasks\\TASK_CURRENT.md', 'https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/main/tasks/TASK_CURRENT.md']
    .forEach(v => ok(v, v));
  ok('  ' + GH('Aegis-Mesh') + ' ', GH('Aegis-Mesh'));   // 前後の空白だけ除く
});
t('空欄は空欄（キーなし）。画面はそのまま保存でき、同期・引継ぎをしない', () => {
  ok('', '');
  ok('   ', '');
});
t('整えられない値は理由を返して入れない（所有者違い・リポジトリ名なし・不正な名前・GitHub以外・相対パス・ドライブだけ）', () => {
  ng('https://github.com/someone-else/Aegis-Mesh', /所有者が xxxinakenxxx-hash ではない/);
  ng('https://github.com/xxxinakenxxx-hash', /リポジトリ名がありません/);
  ng('https://github.com/xxxinakenxxx-hash/', /リポジトリ名がありません/);
  ng('https://github.com/xxxinakenxxx-hash/bad name', /リポジトリ名が正しくありません/);
  ng('https://github.com/xxxinakenxxx-hash?tab=repositories', /リポジトリ名がありません/);
  ng('https://github.com/xxxinakenxxx-hash/..', /リポジトリ名が正しくありません/);
  ng('https://example.com/xxxinakenxxx-hash/Aegis-Mesh', /所定のキーの形にできません/);
  ng('Aegis-Mesh', /所定のキーの形にできません/);
  ng('Documents\\Aegis-Mesh', /所定のキーの形にできません/);
  ng('C:\\', /ドライブだけ/);
  ng('C:', /所定のキーの形にできません/);
});
t('整えた値は、サーバーの案件キー検証と週間分析の案件キー検証（TASK_CURRENT.md で終わる）に合格する', () => {
  const { load } = require('./gas_stub');
  const g = load(); g.setupSheets();
  ['https://github.com/xxxinakenxxx-hash/Aegis-Mesh', 'C:\\Users\\inamori240\\Documents\\Aegis-Mesh'].forEach((raw, i) => {
    const key = norm(raw).value;
    const a = g.createTask({ targetWeek: '2026-10-26', title: 'AI' + i, kind: 'AI案件', caseKey: key });
    assert.strictEqual(g.getTasks('2026-10-26').filter(x => x.taskId === a.taskId)[0].caseKey, key);
  });
});
t('画面：説明書きは指定の文言。入力したら整形して入れ、失敗は理由を表示して元の値に戻す。朝ブリーフ画面には入力欄を追加しない', () => {
  assert.ok(weekly.includes("案件キー（リポジトリの場所。日次AI現在地の自動同期と、翌週以降の指示ルート引継ぎに使う。リポジトリのアドレスを貼れば形を整えます。空欄なら同期・引継ぎをしない）"));
  assert.ok(!weekly.includes('案件キー（AI案件.md に記載された TASK_CURRENT.md の場所。翌週以降の指示ルートの引継ぎに使う'));
  assert.ok(weekly.includes('var r = normalizeCaseKeyInput(ki.value);'));
  assert.ok(weekly.includes("App.showError('案件キーを入れられません：' + r.reason); ki.value = t.caseKey || ''; return;"));
  assert.ok(weekly.includes('ki.value = r.value;'));
  const brief = fs.readFileSync(path.join(__dirname, '..', 'src/brief.html'), 'utf8');
  assert.ok(!/caseKey-input|wk-casekey|normalizeCaseKeyInput/.test(brief));
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
