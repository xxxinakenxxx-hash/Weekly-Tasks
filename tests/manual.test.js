// 操作マニュアル（src/view_manual.html）のテスト：node tests/manual.test.js
// 付録A〜Cが docs/prompts の指示文と一字も違わないこと（指示文だけ直してマニュアルが古いまま、を防ぐ）
const assert = require('assert');
const fs = require('fs'), path = require('path');
const { build, block, APPENDIX } = require('../tools/build_manual');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const html = fs.readFileSync(path.join(__dirname, '..', 'src/view_manual.html'), 'utf8');
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

t('マニュアルは最新の指示文から作られている（node tools/build_manual.js を実行し直しても変わらない）', () => {
  assert.ok(build() === html, '指示文とマニュアルがずれています。node tools/build_manual.js を実行してください');
});
Object.keys(APPENDIX).forEach(k => t('付録' + k + 'の文が ' + APPENDIX[k] + ' と一字も違わない', () => {
  const m = html.match(new RegExp('<pre id="appendix-' + k.toLowerCase() + '">([\\s\\S]*?)</pre>'));
  assert.ok(m, '付録がない');
  assert.strictEqual(unesc(m[1]), block(APPENDIX[k]));
}));
t('付録Bに今日の決まり（AI案件は必ず案に出す）・案件キーが入っている。付録Cに案件キーが入っている', () => {
  assert.ok(html.includes('必ずすべてタスク案に出す'));
  assert.ok(/appendix-b[\s\S]*案件キー/.test(html));
  assert.ok(/appendix-c[\s\S]*案件キー/.test(html));
});
t('?view=manual でマニュアルを開ける。画面の「操作マニュアル」はこのページを開く', () => {
  const g = load();
  let file = null, url = null;
  g.ScriptApp = { getService: () => ({ getUrl: () => 'https://example/dev' }) };
  g.HtmlService = { createTemplateFromFile: f => { file = f; const tp = { evaluate() { url = tp.appUrl; const o = { setTitle() { return o; }, addMetaTag() { return o; } }; return o; } }; return tp; } };
  g.doGet({ parameter: { view: 'manual' } });
  assert.strictEqual(file, 'view_manual');
  assert.strictEqual(url, 'https://example/dev');
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'src/index.html'), 'utf8').includes('href="<?= ctx.appUrl ?>?view=manual"'));
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
