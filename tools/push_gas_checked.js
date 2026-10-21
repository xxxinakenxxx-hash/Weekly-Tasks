// GAS /dev 反映を安全に行うための唯一の入口。
// 1) 作業ツリーが clean であることを確認
// 2) 操作マニュアルを docs/prompts から再生成
// 3) manual.test.js で A〜F の一字一致を確認
// 4) 再生成で差分が出たら停止（先にコミットさせる）
// 5) .clasp.json の接続先を固定値で確認
// 6) clasp push --force
// 7) deployments が前後で変わっていないことを確認
const fs = require('fs');
const cp = require('child_process');

const EXPECTED_SCRIPT_ID = '1PVnJColm5Rt3qGkSZnS0xT8mFWRAVZAMAPk3-enNalM0P_lA2zcRyZtS';
const EXPECTED_ROOT_DIR = 'src';

function run(cmd, opts) {
  const r = cp.spawnSync(cmd, { shell: true, encoding: 'utf8', stdio: opts && opts.capture ? 'pipe' : 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const out = ((r.stdout || '') + (r.stderr || '')).trim();
    throw new Error(cmd + ' failed' + (out ? '\n' + out : ''));
  }
  return (r.stdout || '').trim();
}

function status() {
  return run('git status --porcelain', { capture: true });
}

if (status()) {
  throw new Error('作業ツリーに未コミット変更があります。GASへ反映しません。先に内容を確認してコミットしてください。');
}

run('node tools/build_manual.js');
run('node tests/manual.test.js');

const diff = cp.spawnSync('git diff --exit-code -- src/view_manual.html', { shell: true, encoding: 'utf8', stdio: 'pipe' });
if (diff.status !== 0) {
  process.stdout.write(diff.stdout || '');
  process.stderr.write(diff.stderr || '');
  throw new Error('操作マニュアルが最新ではなかったため再生成しました。GASへはまだ反映していません。src/view_manual.html を確認・コミットしてから、このスクリプトをもう一度実行してください。');
}

const clasp = JSON.parse(fs.readFileSync('.clasp.json', 'utf8'));
if (clasp.scriptId !== EXPECTED_SCRIPT_ID || clasp.rootDir !== EXPECTED_ROOT_DIR) {
  throw new Error('.clasp.json の接続先が確認済み値と違います。GASへ反映しません。');
}

const before = run('clasp deployments', { capture: true });
run('clasp push --force');
const after = run('clasp deployments', { capture: true });

if (before !== after) {
  throw new Error('clasp push 前後で deployment 一覧が変化しました。公開版を変更していないか確認してください。');
}

if (status()) {
  throw new Error('GAS反映後に作業ツリーへ差分が発生しました。内容を確認してください。');
}

console.log('GAS /dev 反映完了：マニュアル同期確認済み、公開 deployment 一覧は不変です。');
