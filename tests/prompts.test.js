// 週次・日次AI巡回の指示文（docs/prompts/desktop_work_ai.md・desktop_work_ai_daily.md）の回帰テスト：node tests/prompts.test.js
// 2026-10-12 の巡回で起きた「工程の巻き戻り」「週次・日次の判定の食い違い」「GitHub取得失敗」を、指示文の決まりとして防げているかを確かめる。
// （Work 自体の動きは、実際の巡回結果で確かめる。ここでは指示文が判定の決まりを正しく・同じように書いているかを確かめる）
const assert = require('assert');
const fs = require('fs'), path = require('path');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
// コードブロック（```〜```）の中＝Workに渡す指示文
const block = s => { const m = s.match(/^```\n([\s\S]*?)\n```$/m); assert.ok(m, 'コードブロックがない'); return m[1]; };
const weekly = block(read('docs/prompts/desktop_work_ai.md'));
const daily = block(read('docs/prompts/desktop_work_ai_daily.md'));
const criteria = s => { const i = s.indexOf('判定基準（週次・日次共通'); const j = s.indexOf('\nルール：', i); assert.ok(i >= 0 && j > i, '判定基準の節がない'); return s.slice(i, j); };

// ---- 3. 週次・日次で同じ判定基準 ----
t('週次・日次の判定基準（A〜E）が一字も違わず同じ', () => {
  assert.strictEqual(criteria(weekly), criteria(daily));
  ['A. 現在地の決め方', 'B. 前回の現在地との照合', 'C. 判定の区別', 'D. GitHub', 'E. 対象と案件キー'].forEach(h => assert.ok(criteria(weekly).includes(h), h));
});
t('週次・日次とも、書式に「現在地の根拠」「前回の現在地」「前回からの変化」がある', () => {
  [weekly, daily].forEach(s => ['- 台帳の最新記録日：', '- 現在地の根拠：', '- 前回の現在地：', '- 前回からの変化：変更なし／前進（根拠）／要確認（理由）'].forEach(f => assert.ok(s.includes(f), f)));
});

// ---- 1. 工程の巻き戻り（10/12：機械売上管理システム＝2026-07-06「工程B」、管理職AIメモ＝2026-07-28「IS-01」を採った） ----
t('回帰（巻き戻り）：「日付のあるいちばん新しい記録を現在地とする」決まり（10/12 の原因）が残っていない', () => {
  [weekly, daily].forEach(s => {
    assert.ok(!s.includes('日付（yyyy-MM-dd など）のある記録のうち、いちばん新しい記録を今の現在地とする'));
    assert.ok(!s.includes('日付が古い記載や日付のない記載は、今の現在地として採らない'));
  });
});
t('回帰（巻き戻り）：冒頭の現在工程・現在地を最優先し、日付が無くても採る。過去の日付付き記録だけで前の工程へ戻さない', () => {
  const c = criteria(weekly);
  assert.ok(c.includes('冒頭（最初の見出し群）にある「現在工程」「現在地」「状態」などの欄を最優先で現在地とする。欄に日付が無くても採る'));
  assert.ok(c.includes('本文の日付付きの過去の記録（作業ログ）だけを根拠に、冒頭の欄より前の工程へ戻さない'));
  assert.ok(c.includes('冒頭の欄より後の工程に進んだことを示す記録（実装・試験・完了）がある場合だけ'));
});
t('回帰（巻き戻り）：前回より前の工程は、根拠が明記されていなければ採らず、前回の現在地＋要確認にする', () => {
  const c = criteria(weekly);
  assert.ok(c.includes('前回より前の工程になる場合は'));
  assert.ok(c.includes('そうでなければ今回の判断を採らず、前回の現在地を書いたうえで「前回からの変化：要確認'));
  assert.ok(c.includes('週次＝上書きする前の AI案件.md、日次＝上書きする前の AI案件_日次現在地.md'));
});

// ---- 2/4. 週次・日次の判定の食い違い（10/12：機械販売事例アプリ＝週次 不一致／日次 確認済み） ----
t('回帰（判定の区別）：実際の矛盾・古い記録・チャット未確認・取得失敗を分けて書く', () => {
  const c = criteria(weekly);
  assert.ok(/実際の矛盾：[^\n]*同じ時点かそれより新しい資料[^\n]*→「不一致」/.test(c));
  assert.ok(/古い記録・古い資料：[^\n]*→ 不一致にしない/.test(c));
  assert.ok(/チャット未確認：[^\n]*「確認済み」（週次は「情報源整合：一致」）/.test(c));
  assert.ok(/取得失敗：[^\n]*すべての経路で読めなかった/.test(c));
});
t('回帰（判定の区別）：ルール欄の書き方も判定基準Cに合わせている（チャット未確認だけで不一致・未確認扱いにしない）', () => {
  assert.ok(weekly.includes('要確認欄に「チャット未確認」と書く（判定基準 C。実際の矛盾が無ければ情報源整合は「一致」'));
  assert.ok(daily.includes('取得結果は判定基準 C で決める'));
  assert.ok(!daily.includes('対応するCodexチャットを特定できない場合は「チャット未確認」、判断できない場合は「要確認」とする。'));
});

// ---- 5. GitHub取得失敗（10/12 週次：4か所とも Cache miss で取得失敗） ----
t('回帰（GitHub）：TASK_CURRENT.md は4つの経路を順に試し、1つ目で失敗しても取得失敗にしない', () => {
  const c = criteria(weekly);
  ['https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md',
    'https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md?plain=1',
    'https://raw.githubusercontent.com/xxxinakenxxx-hash/Weekly-Tasks/HEAD/tasks/TASK_CURRENT.md',
    'https://raw.githubusercontent.com/xxxinakenxxx-hash/Weekly-Tasks/refs/heads/claude/gallant-dijkstra-m5gen1/tasks/TASK_CURRENT.md'].forEach(u => assert.ok(c.includes(u), u));
  assert.ok(c.includes('1つ目で読めなくても取得失敗にしない'));
  assert.ok(c.includes('すべて失敗した場合だけ、経路ごとのエラーを書いて「取得失敗」とする'));
  assert.ok(weekly.includes('判定基準 D のすべての経路を試し'));
});
t('回帰（GitHub）：開発履歴にも別の経路（コミットの atom）がある', () => {
  assert.ok(criteria(weekly).includes('https://github.com/xxxinakenxxx-hash/Weekly-Tasks/commits/claude/gallant-dijkstra-m5gen1.atom'));
});

// ---- 6. 対象5案件と案件キー ----
t('対象5案件の案件キーが、登録済みの値（Sheets の初期登録・AI_CASES.md）と一字も違わない', () => {
  const g = load();
  const c = criteria(weekly);
  g.CASE_KEY_BACKFILL.items.forEach(it => assert.ok(c.includes('・' + it.title + '：' + it.caseKey), it.title));
  const cc = 'https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md';
  assert.ok(c.includes('・週間タスク・朝ブリーフ：' + cc));
  assert.ok(read('docs/AI_CASES.md').includes('`' + cc + '`'));
  [weekly, daily].forEach(s => assert.ok(s.includes('TASK_CURRENT.md の場所（案件キーとしてそのまま書く）：' + cc)));
  assert.strictEqual((c.match(/^    ・/mg) || []).length, 5);
});
t('既存の巡回範囲（Documents の検索・複製フォルダの除外・保存先）は変えていない', () => {
  assert.ok(weekly.includes('C:\\Users\\inamori240\\Documents 配下から「TASK_CURRENT.md」という名前のファイルをすべて探し'));
  assert.ok(weekly.includes('営業AIメモ_chat_file_copies_20260719」はチャットファイルの複製でリポジトリではないため'));
  assert.ok(weekly.includes('「週間タスク」フォルダ直下の「AI案件.md」へ保存してください'));
  assert.ok(daily.includes('「週間タスクボード」フォルダ直下の「AI案件_日次現在地.md」へ保存してください'));
});

// ---- 10/12 の各案件：どの決まりで防ぐか（実巡回で確かめる期待値の一覧） ----
const SCENARIOS = [
  { case: '機械売上管理システム', bad: '台帳の最新記録日 2026-07-06「工程B」を現在地に採った', expect: '冒頭の欄（第1段階MVP完了判定OK・PH1-FIX-03B）を採る。工程Bは過去の記録として採らない', rule: '本文の日付付きの過去の記録（作業ログ）だけを根拠に、冒頭の欄より前の工程へ戻さない' },
  { case: '管理職AIメモ', bad: '2026-07-28「IS-01完了」を採り、IS-13 の資料と不一致にした', expect: '冒頭の欄（IS-13 系）を採る。IS-01 は過去の記録。不一致にしない', rule: '古い記録・古い資料：' },
  { case: '機械販売事例アプリ', bad: '週次＝不一致、日次＝確認済みで食い違った', expect: '週次・日次とも同じ基準Cで判定する（改訂方針書・工程3指示書が台帳の@45記録以降の時点なら実際の矛盾＝不一致）', rule: '週次の AI案件.md と日次の AI案件_日次現在地.md は、必ずこの同じ基準で判定する' },
  { case: '週間タスク・朝ブリーフ', bad: '週次で GitHub 4か所とも Cache miss で取得失敗', expect: '①〜④の経路を順に試し、読めた経路を確認元に書く', rule: '次の順に読めるまで試す' },
  { case: '営業AIメモ', bad: '（回帰確認）P2-08 完了後を維持していた', expect: '冒頭の欄・2026-10-08 の記録から P2-08 完了後を維持。前回と同じなら「変更なし」', rule: '前回と同じなら「前回からの変化：変更なし」' }
];
SCENARIOS.forEach(sc => t('10/12 回帰（' + sc.case + '）：' + sc.bad + ' → 防ぐ決まりが週次・日次の両方にある', () => {
  assert.ok(weekly.includes(sc.rule) && daily.includes(sc.rule), sc.rule);
}));

// ---- 2026-10-12 ユーザー決定：週間分析を取り直したら、今週すでにあるAI案件も必ず案に出す（表の現在地を直すため） ----
t('週間分析の指示文：AI案件は今週すでに行があっても必ず案に出す（通常タスクだけ再生成しない）', () => {
  const wa = block(read('docs/prompts/project_weekly_analysis.md'));
  assert.ok(wa.includes('これと同じ通常タスクはタスク案に出さない'));
  assert.ok(wa.includes('AI案件.md の案件は、対象週に同じ案件の行がすでにあっても、必ずすべてタスク案に出す'));
  assert.ok(wa.includes('タスク名は対象週のその行と同じ名前にし、案件キーを必ず書く'));
});

// ---- 2026-10-14：案件キー（「TASK_CURRENT.md：」の行）への取得経路の混入を、発生源（巡回指示文）で防ぐ ----
const KEY5 = ['C:\\Users\\inamori240\\Documents\\machine-sales-system\\tasks\\TASK_CURRENT.md', 'C:\\Users\\inamori240\\Documents\\機械販売事例アプリ\\tasks\\TASK_CURRENT.md',
  'C:\\Users\\inamori240\\Documents\\営業AIメモ\\tasks\\TASK_CURRENT.md', 'C:\\Users\\inamori240\\Documents\\管理職AIメモ\\tasks\\TASK_CURRENT.md',
  'https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md'];
// 巡回結果（md）の「TASK_CURRENT.md：」の行が案件キーだけになっているかの判定（朝ブリーフ・週間分析が写す値）
const keyLines = md => (md.match(/^\s*-\s*TASK_CURRENT\.md：.*$/mg) || []).map(l => l.replace(/^\s*-\s*TASK_CURRENT\.md：/, '').trim());
const keyOnly = v => KEY5.indexOf(v) >= 0;
t('巡回指示文（週次・日次）：「TASK_CURRENT.md：」の行は案件キーだけ。経路・エラーは「読めた経路：」の行へ', () => {
  [weekly, daily].forEach(s => {
    assert.ok(s.includes('  - TASK_CURRENT.md：（案件キー。判定基準 E のその案件の場所だけを一字も変えずに書き、後ろに何も付けない）'));
    assert.ok(s.includes('  - 読めた経路：（Claude Code案件だけ。TASK_CURRENT.md と開発履歴を読めた経路の番号・方法と、失敗した経路のエラー）'));
    assert.ok(!s.includes('読めた経路を「確認元」に書く。'));
  });
  const c = criteria(weekly);
  assert.ok(c.includes('読めた経路・失敗した経路のエラーは、確認元の「読めた経路：」の行に書く（「TASK_CURRENT.md：」の行には書かない）'));
  assert.ok(c.includes('「TASK_CURRENT.md：」の行には、下の場所だけを書く。場所の後ろに、読めた経路・Cache miss・取得失敗・取得方法（GitHub連携など）・その他の注記を一切付けない'));
  assert.strictEqual(criteria(weekly), criteria(daily));
});
t('巡回指示文：案件キーの固定値（5件）は変えていない', () => {
  KEY5.forEach(k => assert.ok(criteria(weekly).includes('：' + k + '\n') || criteria(weekly).endsWith('：' + k), k));
});
t('回帰（10/14 の日次結果）：5件目の行に経路の説明が付いていたため、案件キーだけの判定で検出できる', () => {
  const md1014 = ['  - TASK_CURRENT.md：' + KEY5[0], '  - TASK_CURRENT.md：' + KEY5[1], '  - TASK_CURRENT.md：' + KEY5[2], '  - TASK_CURRENT.md：' + KEY5[3],
    '  - TASK_CURRENT.md：' + KEY5[4] + '（①WebはCache miss、②～④もCache miss。GitHub連携で同一ファイルを取得）'].join('\n');
  const v = keyLines(md1014);
  assert.deepStrictEqual(v.map(keyOnly), [true, true, true, true, false]);
});
t('修正後の書式どおりの結果（日次・週次）：5件とも「TASK_CURRENT.md：」は案件キーだけ。経路の説明は「読めた経路：」にあり混入しない', () => {
  const route = '  - 読めた経路：①WebはCache miss、②～④もCache miss。GitHub連携で同一ファイルを取得';
  const sample = KEY5.map((k, i) => '## ' + (i + 1) + '. 案件\n- 確認元：\n  - TASK_CURRENT.md：' + k + (i === 4 ? '\n' + route : '')).join('\n');
  const v = keyLines(sample);
  assert.strictEqual(v.length, 5);
  assert.ok(v.every(keyOnly), v.join(' | '));
  assert.ok(sample.includes('Cache miss') && !v.some(x => x.includes('Cache miss')));
  // その値から作るJSON（朝ブリーフ・週間分析）は、Windowsの場所が正しくエスケープされ、読み戻すと同じ値になる
  const json = JSON.stringify({ AI案件現在地: v.map(k => ({ 案件キー: k })) });
  assert.ok(json.includes('"C:\\\\Users\\\\inamori240\\\\Documents\\\\machine-sales-system\\\\tasks\\\\TASK_CURRENT.md"'));
  assert.deepStrictEqual(JSON.parse(json).AI案件現在地.map(x => x.案件キー), KEY5);
});
t('書式の資料（AI_DAILY_FORMAT・OBSIDIAN_FORMAT）も「TASK_CURRENT.md：」は場所だけ・「読めた経路：」の行あり', () => {
  const daf = read('docs/AI_DAILY_FORMAT.md'), obf = read('docs/OBSIDIAN_FORMAT.md');
  assert.ok(daf.includes('  - TASK_CURRENT.md：（ファイルの場所だけ。案件キーとして使うため、後ろに何も付けない）'));
  assert.ok(daf.includes('  - 読めた経路：'));
  assert.ok(obf.includes('  - TASK_CURRENT.md：（ファイルの場所だけ。案件キーとして使うため、後ろに何も付けない。見つからない場合は「なし」）'));
  assert.ok(obf.includes('  - 読めた経路：'));
});
t('週間分析の指示文：案件キーは場所だけ（説明は入れない）・5件の固定値・「\\」の重ね書き・出力前の確認', () => {
  const wa = block(read('docs/prompts/project_weekly_analysis.md'));
  assert.ok(wa.includes('ファイルの場所（TASK_CURRENT.md で終わる部分）だけを一字も変えずに書く。場所のあとに続く括弧書き・取得経路・エラーなどの説明は「案件キー」に入れない'));
  KEY5.forEach(k => assert.ok(wa.includes('    ・' + k), k));
  assert.ok(wa.includes('文字列の中の「\\」（Windowsの場所の区切り）は、JSONでは「\\\\」と2つ重ねて書く'));
  assert.ok(wa.includes('出力する前に、JSONとして読み込めること'));
  assert.ok(wa.includes('タスク名や他の案件から推測して書かない'));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
