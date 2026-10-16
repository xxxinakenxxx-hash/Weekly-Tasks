// 2026-10-14 朝ブリーフJSON読み込み失敗の回帰テスト：node tests/brief_json.test.js
// ① Windowsの場所の「\」がJSONで重ねて書かれずJSONとして読めない ② 案件キーに説明文が混入（5件目）
const assert = require('assert');
const fs = require('fs'), path = require('path');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const W = '2026-10-12', D = '2026-10-14', AT = '2026-10-14 06:19';
const DOC = 'C:\\Users\\inamori240\\Documents\\';
const KEYS = {
  machine: DOC + 'machine-sales-system\\tasks\\TASK_CURRENT.md',
  sales: DOC + '機械販売事例アプリ\\tasks\\TASK_CURRENT.md',
  memo: DOC + '営業AIメモ\\tasks\\TASK_CURRENT.md',
  mgr: DOC + '管理職AIメモ\\tasks\\TASK_CURRENT.md',
  weekly: 'https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md'
};
// 10/14 の AI案件_日次現在地.md（06:19）の5件目「TASK_CURRENT.md：」の行そのまま（場所のあとに取得経路の説明が続いている）
const MIXED = KEYS.weekly + '（①WebはCache miss、②～④もCache miss。GitHub連携で同一ファイルを取得）';
function setup() {
  const g = load(); g.setupSheets();
  const ids = {};
  [['machine', '機械売上管理システム'], ['sales', '機械販売事例アプリ'], ['memo', '営業AIメモ'], ['mgr', '管理職AIメモ'], ['weekly', '週間タスク・朝ブリーフ']].forEach(([k, title]) => {
    ids[k] = g.createTask({ targetWeek: W, title, kind: 'AI案件', caseKey: KEYS[k], aiPosition: '前の現在地：' + title }).taskId;
  });
  return { g, ids };
}
// 10/14 の日次ファイルの内容で、指示文どおりに作った朝ブリーフJSON（文字列）
function json1014(ids, over) {
  const ai = [
    { k: 'machine', 名: '機械売上管理システム', 結果: '確認済み', 現在地: 'PH1-FIX-03B 実画面で案件一覧速度の再確認待ち。第1段階MVP完了判定OK', 内容: 'チャット未確認' },
    { k: 'sales', 名: '機械販売事例アプリ', 結果: '確認済み', 現在地: '工程3・事実確認・販売事例編纂。実装再チェック・実機再確認待ち', 内容: 'チャット未確認' },
    { k: 'memo', 名: '営業AIメモ', 結果: '確認済み', 現在地: 'delivery_daily_log実DB作成完了。次工程には進んでいない', 内容: 'チャット未確認' },
    { k: 'mgr', 名: '管理職AIメモ', 結果: '確認済み', 現在地: 'IS-13A 性能未達修正。実機再確認待ち', 内容: 'チャット未確認' },
    { k: 'weekly', 名: '週間タスク・朝ブリーフ', 結果: '取得失敗', 現在地: '', 内容: 'GitHub docs/officialのDOCX正本とIS-06 DOCX指示書の本文を読めなかった（①WebはCache miss、GitHub連携で台帳は取得）' }
  ].map(x => ({ 案件キー: KEYS[x.k], taskId: ids[x.k], 案件名: x.名, 取得結果: x.結果, 現在地: x.現在地, 取得日時: AT, 内容: x.内容 }));
  const data = { 日付: D, 今日の一言: '今日はIS-06の確認が中心', 今日の流れ: ['09:00 朝礼'], 今日優先すること: [], 気にかけておきたいこと: ['取得失敗：週間タスク・朝ブリーフ／DOCX本文を読めなかった'], もう片づいていること: [], '未完了・持越し': [], AI案件現在地: ai };
  if (over) over(data);
  return JSON.stringify(data, null, 2);
}
// 画面側（src/brief.html）と同じ変換：JSONのキー → サーバーへ渡す形
function toServer(text) {
  const d = JSON.parse(text);
  return {
    date: d['日付'], oneLine: d['今日の一言'], flow: d['今日の流れ'], priorities: d['今日優先すること'], concerns: d['気にかけておきたいこと'], done: d['もう片づいていること'], carryover: d['未完了・持越し'],
    aiPositions: (d['AI案件現在地'] || []).map(x => ({ taskId: x.taskId, caseKey: x['案件キー'], title: x['案件名'], result: x['取得結果'], position: x['現在地'], at: x['取得日時'], note: x['内容'] }))
  };
}
const row = (g, id) => g.getTasks(W).find(x => x.taskId === id);

t('① 再現：Windowsの場所の「\\」を重ねずに書いたJSONは読めない（JSON構文エラー）', () => {
  const { ids } = setup();
  const good = json1014(ids);
  const bad = good.split('\\\\').join('\\');  // 「\\」→「\」（重ね書きしなかった状態）
  assert.throws(() => JSON.parse(bad), SyntaxError);
});
t('① Windowsの場所を「\\\\」で書いたJSONは読め、案件キーが元の場所に戻る', () => {
  const { ids } = setup();
  const text = json1014(ids);
  assert.ok(text.includes('"C:\\\\Users\\\\inamori240\\\\Documents\\\\machine-sales-system\\\\tasks\\\\TASK_CURRENT.md"'));
  assert.strictEqual(JSON.parse(text)['AI案件現在地'][0]['案件キー'], KEYS.machine);
});
t('正しいGitHubの案件キーは受け付ける', () => {
  const { g, ids } = setup();
  const b = g.normalizeBrief_(toServer(json1014(ids)));
  assert.strictEqual(b.aiPositions[4].caseKey, KEYS.weekly);
});
t('② 再現：説明文が混入した案件キー（10/14 の5件目）は受け付けず、何も書かない', () => {
  const { g, ids } = setup();
  const text = json1014(ids, d => { d['AI案件現在地'][4]['案件キー'] = MIXED; });
  const h = JSON.stringify(g.__sheets['タスク'].data);
  assert.throws(() => g.saveMorningBrief(toServer(text)), /案件キーは TASK_CURRENT\.md の場所です/);
  assert.strictEqual(JSON.stringify(g.__sheets['タスク'].data), h);
  assert.strictEqual(g.getMorningBrief(D).brief, null);
});
t('画面の読み込み（src/brief.html）も、説明文が混入した案件キーを検出する検証になっている', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src/brief.html'), 'utf8');
  assert.ok(html.includes("if (it.caseKey && !/TASK_CURRENT\\.md$/i.test(it.caseKey)) errors.push(n + '「案件キー」は TASK_CURRENT.md の場所です。');"));
  assert.ok(!/TASK_CURRENT\.md$/i.test(MIXED));
});
t('10/14 の内容（正しい形式）で保存できる：確認済み4件は現在地を更新、取得失敗は最新取得だけ記録し現在地は変えない', () => {
  const { g, ids } = setup();
  const res = g.saveMorningBrief(toServer(json1014(ids)));
  assert.strictEqual(res.aiSync.synced.length, 4);
  assert.strictEqual(res.aiSync.recorded.length, 1);
  assert.strictEqual(res.aiSync.skipped.length, 0);
  assert.strictEqual(row(g, ids.machine).aiPosition, 'PH1-FIX-03B 実画面で案件一覧速度の再確認待ち。第1段階MVP完了判定OK');
  const w = row(g, ids.weekly);
  assert.strictEqual(w.aiPosition, '前の現在地：週間タスク・朝ブリーフ');
  assert.ok(String(w.aiLatestResult).startsWith('取得失敗：'));
  assert.strictEqual(String(w.aiConfirmedAt || ''), '');
});
t('取得失敗の案件は、取得失敗のまま読み込める（確認済みに変わらない）', () => {
  const { g, ids } = setup();
  const b = g.normalizeBrief_(toServer(json1014(ids)));
  assert.strictEqual(b.aiPositions[4].result, '取得失敗');
});
t('案件キーとtaskIdが別の行を指す場合は同期しない（誤同期しない）', () => {
  const { g, ids } = setup();
  const text = json1014(ids, d => { d['AI案件現在地'][0].taskId = ids.memo; });
  const res = g.saveMorningBrief(toServer(text));
  assert.ok(res.aiSync.skipped.some(s => /別の行/.test(s.reason)));
  assert.strictEqual(row(g, ids.machine).aiPosition, '前の現在地：機械売上管理システム');
  assert.strictEqual(row(g, ids.memo).aiPosition, 'delivery_daily_log実DB作成完了。次工程には進んでいない');
});
t('案件名だけが一致しても（案件キー・taskIdなし）同期しない', () => {
  const { g, ids } = setup();
  const text = json1014(ids, d => { d['AI案件現在地'][0]['案件キー'] = ''; d['AI案件現在地'][0].taskId = ''; });
  const res = g.saveMorningBrief(toServer(text));
  assert.ok(res.aiSync.skipped.some(s => /案件キー・taskIdがない/.test(s.reason)));
  assert.strictEqual(row(g, ids.machine).aiPosition, '前の現在地：機械売上管理システム');
});
// ---- 指示文（docs/prompts/project_morning_brief.md）に再発防止の決まりがあること ----
const block = s => s.match(/^```\n([\s\S]*?)\n```$/m)[1];
const prompt = block(fs.readFileSync(path.join(__dirname, '..', 'docs/prompts/project_morning_brief.md'), 'utf8'));
t('指示文：案件キーは場所（TASK_CURRENT.md で終わる部分）だけ。説明は「内容」へ。2つの形（固定の一覧なし。2026-10-15）', () => {
  assert.ok(prompt.includes('ファイルの場所（TASK_CURRENT.md で終わる部分）だけを一字も変えずに書く'));
  assert.ok(prompt.includes('場所のあとに続く括弧書き・取得経路・エラーなどの説明は「案件キー」に入れない（必要なら「内容」に書く）'));
  assert.ok(prompt.includes('    ・C:\\Users\\inamori240\\Documents\\（フォルダ名）\\tasks\\TASK_CURRENT.md'));
  assert.ok(prompt.includes('    ・https://github.com/xxxinakenxxx-hash/（リポジトリ名）/blob/HEAD/tasks/TASK_CURRENT.md'));
  Object.values(KEYS).forEach(k => assert.ok(!prompt.includes(k), '固定値が残っている：' + k));
});
t('指示文：「\\」を「\\\\」と重ねて書く決まりと例（例は固定案件名ではない）', () => {
  assert.ok(prompt.includes('文字列の中の「\\」（Windowsの場所の区切り）は、JSONでは「\\\\」と2つ重ねて書く'));
  assert.ok(prompt.includes('"C:\\\\Users\\\\inamori240\\\\Documents\\\\sample-project\\\\tasks\\\\TASK_CURRENT.md"'));
});
t('指示文：出力前の確認（JSONとして読める・必須項目・案件キーの形・すべての案件・取得結果を変えない）', () => {
  ['JSONとして読み込める', '「日付」「今日の一言」「今日の流れ」「今日優先すること」「気にかけておきたいこと」「もう片づいていること」「未完了・持越し」がそろっている',
    '「案件キー」は、空か、上のどちらかの形（TASK_CURRENT.md で終わり、説明が付いていない）', 'AI案件_日次現在地.md のすべての案件（件数は決まっていない）が入っていて、各件の「案件キー」が AI案件_日次現在地.md のその案件の「TASK_CURRENT.md：」の値と一字も違わない（「今回読んだTASK_CURRENT.md：」の値を案件キーにしない）',
    '「取得結果」は AI案件_日次現在地.md の値のまま', '取得失敗の案件を「確認済み」に変えない'].forEach(x => assert.ok(prompt.includes(x), x));
  assert.ok(prompt.includes('案件名（タスク名）で対応付けない'));
  assert.ok(!prompt.includes('固定値'));
});
// ---- 2026-10-15：6件目以降の案件（自動発見で増えた GitHub だけの案件を含む）も朝ブリーフで同期できる ----
t('6件目以降：GitHub だけで見つかった新しい案件を含む7件の朝ブリーフJSONを読み、7件とも同期できる（件数の上限なし）', () => {
  const { g, ids } = setup();
  const NEW = { 'repo-x': 'https://github.com/xxxinakenxxx-hash/repo-x/blob/HEAD/tasks/TASK_CURRENT.md', 'repo-y': 'https://github.com/xxxinakenxxx-hash/repo-y/blob/HEAD/tasks/TASK_CURRENT.md' };
  Object.keys(NEW).forEach(r => { ids[r] = g.createTask({ targetWeek: W, title: r, kind: 'AI案件', caseKey: NEW[r] }).taskId; });
  const text = json1014(ids, d => {
    d['AI案件現在地'][4] = Object.assign(d['AI案件現在地'][4], { 取得結果: '確認済み', 現在地: 'IS-06 継続', 内容: '' });
    Object.keys(NEW).forEach(r => d['AI案件現在地'].push({ 案件キー: NEW[r], taskId: '', 案件名: r, 取得結果: '確認済み', 現在地: r + ' の現在地', 取得日時: AT, 内容: '' }));
  });
  const res = g.saveMorningBrief(toServer(text));
  assert.strictEqual(res.aiSync.synced.length, 7);
  assert.strictEqual(res.aiSync.skipped.length, 0);
  assert.strictEqual(row(g, ids['repo-y']).aiPosition, 'repo-y の現在地');
});
t('6件目以降：新しい案件の案件キーに説明文が付いた場合も拒否する（形は同じ決まり）', () => {
  const { g, ids } = setup();
  const text = json1014(ids, d => d['AI案件現在地'].push({ 案件キー: 'https://github.com/xxxinakenxxx-hash/repo-x/blob/HEAD/tasks/TASK_CURRENT.md（GitHub連携で取得）', taskId: '', 案件名: 'repo-x', 取得結果: '取得失敗', 現在地: '', 取得日時: AT, 内容: 'x' }));
  assert.throws(() => g.saveMorningBrief(toServer(text)), /6件目：案件キーは TASK_CURRENT\.md の場所です/);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
