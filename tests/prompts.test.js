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
  ['A. 現在地の決め方', 'B. 前回の現在地との照合', 'C. 判定の区別', 'D. GitHub', 'E. 案件キーの決まり'].forEach(h => assert.ok(criteria(weekly).includes(h), h));
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

// ---- 5. GitHub取得失敗（10/12 週次：4か所とも Cache miss で取得失敗）→ 2026-10-15 からは案件ごとのリポジトリ名で同じ経路を試す ----
t('回帰（GitHub）：TASK_CURRENT.md は GitHub連携 → 複数の経路を順に試し、1つ目で失敗しても取得失敗にしない（リポジトリ名は固定しない）', () => {
  const c = criteria(weekly);
  ['https://github.com/xxxinakenxxx-hash/{リポジトリ}/blob/HEAD/tasks/TASK_CURRENT.md',
    'https://github.com/xxxinakenxxx-hash/{リポジトリ}/blob/HEAD/tasks/TASK_CURRENT.md?plain=1',
    'https://raw.githubusercontent.com/xxxinakenxxx-hash/{リポジトリ}/HEAD/tasks/TASK_CURRENT.md'].forEach(u => assert.ok(c.includes(u), u));
  assert.ok(c.includes('TASK_CURRENT.md は、GitHub連携で読む。読めなければ次の順に読めるまで試す。1つ目で読めなくても取得失敗にしない'));
  assert.ok(c.includes('すべて失敗した場合だけ、経路ごとのエラーを書いて「取得失敗」とする'));
  assert.ok(weekly.includes('判定基準 D のすべての経路を試し'));
  assert.ok(c.includes('開発履歴は GitHub連携のコミット履歴、読めなければ https://github.com/xxxinakenxxx-hash/{リポジトリ}/commits/HEAD'));
});

// ---- 6. 案件の自動発見（2026-10-15：固定の5案件をやめる） ----
const step1 = s => { const i = s.indexOf('1. 案件の見つけ方'); const j = s.indexOf('\n2. 案件ごとに次を読む。', i); assert.ok(i >= 0 && j > i, '手順1がない'); return s.slice(i, j); };
const FIXED_NAMES = ['machine-sales-system', '機械売上管理システム', '機械販売事例アプリ', '営業AIメモ', '管理職AIメモ', '週間タスク・朝ブリーフ', 'Weekly-Tasks',
  'external-voice-poc', 'AI-memo', 'New-Sales-Cases', '_chat_file_copies_', 'gallant-dijkstra'];
const ALL_PROMPTS = () => ({ weekly, daily, analysis: block(read('docs/prompts/project_weekly_analysis.md')), brief: block(read('docs/prompts/project_morning_brief.md')) });
t('固定案件名・リポジトリ名・個別フォルダ名が、巡回・週間分析・朝ブリーフの指示文に残っていない', () => {
  Object.entries(ALL_PROMPTS()).forEach(([k, s]) => FIXED_NAMES.forEach(n => assert.ok(!s.includes(n), k + '：' + n)));
});
t('固定の件数（5案件・4案件・1A）の前提が残っていない', () => {
  Object.entries(ALL_PROMPTS()).forEach(([k, s]) => {
    assert.ok(!/[0-9０-９]+案件/.test(s), k + '：N案件');
    assert.ok(!/対象[0-9０-９]+件/.test(s), k + '：対象N件');
    assert.ok(!/^1A\./m.test(s), k + '：1A');
    assert.ok(!s.includes('固定値'), k + '：固定値');
  });
});
t('ローカル探索：Documents 直下の各フォルダの tasks\\TASK_CURRENT.md だけを確かめる（Documents 全体の再帰検索をしない）', () => {
  [weekly, daily].forEach(s => {
    const a = step1(s);
    assert.ok(a.includes('C:\\Users\\inamori240\\Documents の直下のフォルダだけを一覧にする。直下の各フォルダについて「（フォルダ）\\tasks\\TASK_CURRENT.md」があるかだけを確かめ'));
    assert.ok(a.includes('サブフォルダの中まで再帰して探さない。Documents 全体を「TASK_CURRENT.md」という名前で検索しない'));
    assert.ok(!s.includes('配下から「TASK_CURRENT.md」という名前のファイルをすべて探し'));
  });
});
t('GitHub探索：所有者 xxxinakenxxx-hash のリポジトリ一覧 → 各デフォルトブランチの tasks/TASK_CURRENT.md。404は次へ。全体コード検索を主経路にしない', () => {
  [weekly, daily].forEach(s => {
    const a = step1(s);
    assert.ok(a.includes('GitHub連携で、所有者 xxxinakenxxx-hash のアクセスできるリポジトリの一覧を取得する（リポジトリ名は決めない）。一覧の各リポジトリのデフォルトブランチに「tasks/TASK_CURRENT.md」があるかを確かめ'));
    assert.ok(a.includes('無い（404）リポジトリは案件ではないとして次へ進む（取得失敗にしない）'));
    assert.ok(a.includes('リポジトリを指定しない GitHub 全体のコード検索は、案件を探す方法として使わない'));
    assert.ok(a.includes('必ず所有者 xxxinakenxxx-hash のリポジトリ一覧から始める'));
    assert.ok(a.includes('一覧を取得できなかった場合は、GitHub の案件を推測で補わず'));
  });
});
t('同じ案件の判定：ローカルの .git\\config の origin を owner/repo にして GitHub の案件と一致したときだけ。origin なし・読めない・不一致は統合しない', () => {
  [weekly, daily].forEach(s => {
    const a = step1(s);
    assert.ok(a.includes('「（フォルダ）\\.git\\config」の [remote "origin"] の url を読む'));
    assert.ok(a.includes('ローカルの案件候補のリポジトリが、1-2 で見つかった案件候補の xxxinakenxxx-hash/リポジトリ名 と一致する場合だけ、同じ案件として1件にまとめる'));
    assert.ok(a.includes('origin が無い・読めない場合、または一致しない場合は、同じ案件とみなさない（別の案件として扱う）。名前が似ているだけで同じ案件にしない'));
    assert.ok(a.includes('GitHub のそのリポジトリに tasks/TASK_CURRENT.md が無い（404）場合は、ローカルだけの案件として続ける'));
  });
});
t('更新日時の比較：ローカルはファイルの最終更新日時、GitHub は最後に変更したコミットの日時（実機で確認した取得）。取れない・同じ時刻は要確認', () => {
  [weekly, daily].forEach(s => {
    const a = step1(s);
    assert.ok(a.includes('2026-10-15 ユーザー決定：更新日時が新しい方を読む。読む方を変えても案件キーは変えない'));
    assert.ok(a.includes('tasks\\TASK_CURRENT.md のファイルの最終更新日時'));
    assert.ok(a.includes('commits?path=tasks/TASK_CURRENT.md&sha=（デフォルトブランチ）&per_page=1'));
    assert.ok(a.includes('ファイルの中に書かれた日付は使わない'));
    assert.ok(a.includes('どちらかの日時を取れない場合、または同じ時刻の場合は、どちらも採らず「要確認'));
  });
});
t('案件キー：識別子で、今回読んだ方とは別。既存のキー（前回の結果・シート）は必ず引き継ぐ。新しいキーは新規と確定できるときだけ', () => {
  [weekly, daily].forEach(s => {
    const a = step1(s);
    assert.ok(a.includes('1-5. 案件キー（案件の識別子。今回どちらを読んだかとは別。読む方が変わっても変えない）'));
    assert.ok(a.includes('既存の案件を確かめる場所（2系統）：前回の結果（保存する前の AI案件.md と AI案件_日次現在地.md の両方）と、スプレッドシート「週間タスクボード」の「タスク」シートの種別が「AI案件」の行（「タスク名／案件名」列と「案件キー」列。読むだけで変更しない）'));
    // 2026-10-16（実機の Aegis Mesh）：「案件なし」と「案件あり・キーなし」を分ける
    assert.ok(a.includes('まず、それぞれの確かめる場所に、この案件が「ある」か「ない」かを決める（2026-10-16 ユーザー決定。キーが見つからないことだけで「ない」としない。「案件の行はあるがキー欄が空欄」は「ない」ではない）'));
    // 2026-10-16：同じ案件と確定する根拠は有効なキーか owner/repo だけ。名前は新規採番を止める安全側の確認だけ
    assert.ok(a.includes('同じ案件と確定してよいのは、次の強い根拠がある場合だけ（2026-10-16 ユーザー決定）'));
    assert.ok(a.includes('・有効なキー（「TASK_CURRENT.md」で終わる値）が、今回のこの案件の「ローカルの場所」または「GitHub の場所」と同じ'));
    assert.ok(a.includes('今回のこの案件のリポジトリ（ローカルは 1-3 の origin を正規化した owner/repo）と同じ'));
    assert.ok(a.includes('案件名だけでは同じ案件と確定しない。名前の大文字小文字・空白・「-」「_」・記号の違いをなくして比べた結果、部分一致、似ている文字列でも、同じ案件にしない。名前は、誤って新しいキーを決めないための安全側の確認にだけ使う'));
    assert.ok(a.includes('強い根拠では同じとも別とも決められない場合は「既存案件の可能性あり」とする'));
    assert.ok(a.includes('その案件・行のリポジトリが今回と違うと分かる場合は、名前が同じでも別の案件として扱う（名前を理由にまとめない）'));
    assert.ok(a.includes('・有効なキーあり：キーが「TASK_CURRENT.md」で終わる'));
    assert.ok(a.includes('・有効なキーなし：キーが空欄・「なし」・不正（TASK_CURRENT.md で終わらない。例：https://github.com/owner/repo.git）'));
    assert.ok(a.includes('③の2 有効なキーも強い根拠の案件・行も無く、「既存案件の可能性あり」の案件・行がある場合：同じ案件とは確定しない。その行のキーを引き継がず、新しいキーも決めず「案件キー確認不能」とする'));
    // 取り消した決まり（名前の違いをなくして同じ案件とみなす）が残っていない
    assert.ok(!a.includes('「-」「_」の違いは同じとみなす。例：Aegis Mesh と Aegis-Mesh'));
    assert.ok(!a.includes('または名前だけで当たった'));
    assert.ok(a.includes('① 有効なキーが1つ見つかった場合：今回どちらの TASK_CURRENT.md を読んだかに関係なく、必ずそのキーをそのまま使う'));
    assert.ok(a.includes('② 有効なキーが2つ以上見つかった場合') && a.includes('1件にまとめず、新しいキーも決めない。前回のそれぞれの案件キーのまま別の案件として書き'));
    assert.ok(a.includes('③ 有効なキーが無く、強い根拠で同じと確定した「有効なキーなし」の案件・行がある場合：既存の案件なので新しい案件にしない。新しいキーを決めず「案件キー確認不能」とする'));
    assert.ok(a.includes('今回見つけたローカルの場所や GitHub の URL で、その案件のキーを補ったり作り直したりしない。不正なキーも今回の場所へ直さない'));
    assert.ok(a.includes('④ 新しい案件と確定できる場合だけ、新しいキーを決める。新しい案件と確定できるのは、次の2つを両方とも正常に確認でき、両方ともこの案件が「ない」（強い根拠で同じ案件も、「既存案件の可能性あり」の案件・行も無い）場合だけ（2026-10-16 ユーザー決定）'));
    assert.ok(a.includes('・前回の結果：AI案件.md と AI案件_日次現在地.md の両方を、巡回全体の失敗だけを書いたものではない通常の結果として読めた'));
    assert.ok(a.includes('・「タスク」シート：種別が「AI案件」の行の「タスク名／案件名」列と「案件キー」列を読めた'));
    assert.ok(a.includes('・ローカルだけで見つかった：C:\\Users\\inamori240\\Documents\\（直下のフォルダ名）\\tasks\\TASK_CURRENT.md'));
    assert.ok(a.includes('・GitHub だけで見つかった：https://github.com/xxxinakenxxx-hash/（リポジトリ名）/blob/HEAD/tasks/TASK_CURRENT.md'));
    assert.ok(a.includes('・最初からローカルと GitHub の両方で見つかり同じ案件と確かめられた：https://github.com/xxxinakenxxx-hash/（リポジトリ名）/blob/HEAD/tasks/TASK_CURRENT.md'));
    assert.ok(a.includes('⑤ ①〜④に当たらない（どこにもこの案件が見つからず、前回の結果と「タスク」シートのどちらか一方でも正常に確認できなかった）場合：既存の案件か新しい案件か確定できないため、新しいキーを決めない'));
    assert.ok(a.includes('「案件キー確認不能」（③・③の2・⑤）の案件は、「TASK_CURRENT.md：」の行は「なし」、取得結果（週次は情報源整合）は「要確認」、注記（日次は「内容」、週次は「要確認」）の先頭に「案件キー確認不能：'));
    assert.ok(!a.includes('②〜④で決め'));
  });
  // テスト専用ロジック（tools/case_select.js）と同じ決まり：既存キーは引き継ぎ、読めないときは発行しない
  const S = require('../tools/case_select');
  const g = load();
  const READ = { previousRead: true, sheetsRead: true };
  const prev = g.CASE_KEY_BACKFILL.items.map(it => ({ key: it.caseKey })).concat([{ key: S.githubKey('xxxinakenxxx-hash/Weekly-Tasks') }]);
  g.CASE_KEY_BACKFILL.items.forEach(it => assert.strictEqual(S.decideKey({ localFolder: it.caseKey.split('\\')[4] }, prev, READ).key, it.caseKey));
  assert.strictEqual(S.decideKey({ githubRepo: 'xxxinakenxxx-hash/Weekly-Tasks' }, prev, READ).key, 'https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md');
  [{ previousRead: false, sheetsRead: false }, { previousRead: true, sheetsRead: false }, { previousRead: false, sheetsRead: true }]
    .forEach(src => assert.strictEqual(S.decideKey({ githubRepo: 'xxxinakenxxx-hash/AI-memo' }, [], src).key, null));
  // Aegis Mesh（実機）：シートに案件行あり・案件キー空欄 → 新規にせず案件キー確認不能
  const ag = S.decideKey({ githubRepo: 'xxxinakenxxx-hash/Aegis-Mesh' }, [{ key: '', name: 'Aegis Mesh' }], READ);
  assert.deepStrictEqual([ag.key, ag.rule, ag.match], [null, '案件キー確認不能', 'possibleExistingCase']);
});
t('「案件なし」と「案件あり・キーなし」の区別が、巡回の指示文・資料・記録にある（Aegis Mesh の実機確認）', () => {
  const cases = read('docs/AI_CASES.md'), daf = read('docs/AI_DAILY_FORMAT.md'), tc = read('tasks/TASK_CURRENT.md');
  assert.ok(cases.includes('「案件の行はあるがキー欄が空欄」は「案件なし」ではない'));
  assert.ok(cases.includes('③ 有効なキーが無く、強い根拠で同じ案件はある（キー空欄・不正）、または「既存案件の可能性あり」の行がある：新しいキーを決めず「案件キー確認不能」'));
  assert.ok(cases.includes('案件名だけでは同じ案件と確定しない（大文字小文字・空白・「-」「_」・記号の違いをなくした比較、部分一致、似ている文字列でも）'));
  assert.ok(!cases.includes('「-」「_」の違いは同じとみなす。例：Aegis Mesh と Aegis-Mesh）。名前で当たっても'));
  assert.ok(daf.includes('案件名だけでは確定しない') && daf.includes('「既存案件の可能性あり」として同じ案件とは確定せず、新しいキーも決めず「案件キー確認不能」'));
  ['名前だけでは同じ案件と確定しない', '既存案件の可能性あり', 'confirmedSameCase', '名前だけでの誤統合：なし', '案件キー確認不能：GitHub の AI-memo・新販売事例・Aegis Mesh'].forEach(x => assert.ok(tc.includes(x), x));
  assert.ok(daf.includes('案件はあるがキーが空欄・不正なら、新しいキーを決めず「案件キー確認不能」（今回の場所でキーを補わない）'));
  ['Aegis Mesh', '「案件なし」と「案件あり・キーなし」', '案件キー確認不能'].forEach(x => assert.ok(tc.includes(x), x));
  // 旧の「キーもリポジトリも無ければ新規」（名前・空欄の行を見ない）が残っていない
  [weekly, daily].forEach(s => assert.ok(!s.includes('どちらにもこの案件に当たるキーもリポジトリも無い場合だけ')));
  assert.ok(!cases.includes('両方にこの案件のキーもリポジトリも無い（＝新しい案件と確定できる）'));
});
t('旧条件（前回の結果かシートの少なくとも一方を読めれば新規）が、指示文・資料・記録・テスト専用ロジックに残っていない', () => {
  const files = ['docs/prompts/desktop_work_ai.md', 'docs/prompts/desktop_work_ai_daily.md', 'docs/prompts/project_weekly_analysis.md', 'docs/prompts/project_morning_brief.md',
    'docs/AI_CASES.md', 'docs/AI_DAILY_FORMAT.md', 'docs/OBSIDIAN_FORMAT.md', 'tools/case_select.js', 'src/view_manual.html'];
  files.forEach(f => { const t = read(f); assert.ok(!t.includes('少なくとも一方'), f); assert.ok(!t.includes('どちらも読めず新しい案件と確定できない'), f); });
  const tc = read('tasks/TASK_CURRENT.md');
  assert.ok(!tc.includes('少なくとも一方を読めて'));
  assert.ok(tc.includes('前回結果とSheetsの両方を確認でき、両方に不存在の場合だけ新規案件キーを発行する。片方でも確認不能なら案件キー確認不能として発行しない'));
  ['docs/AI_CASES.md', 'docs/AI_DAILY_FORMAT.md'].forEach(f => assert.ok(read(f).includes('両方'), f));
});
t('下流：案件キー確認不能の案件は、週間分析ではタスク案に出さず、朝ブリーフでは案件キー・taskId を空にして同期しない', () => {
  const wa = block(read('docs/prompts/project_weekly_analysis.md')), mb = block(read('docs/prompts/project_morning_brief.md'));
  assert.ok(wa.includes('要確認欄が「案件キー確認不能：」で始まる案件はタスク案に出さず、コーションに「要確認：案件キー確認不能：案件名／内容」と書く'));
  assert.ok(mb.includes('場所が書かれていない（「なし」など。案件キー確認不能の案件）場合は空にし、taskId も空にする（同期させない）'));
  // アプリは案件キー・taskId のない項目を同期しない（既存の動き。アプリは変えていない）
  const g = load(); g.setupSheets();
  const res = g.saveMorningBrief({ date: '2026-10-16', oneLine: 'x', flow: [], priorities: [], concerns: [], done: [], carryover: [],
    aiPositions: [{ taskId: '', caseKey: '', title: '案件', result: '要確認', position: '', at: '2026-10-16 06:19', note: '案件キー確認不能：前回の結果・シートを読めなかった' }] });
  assert.match(res.aiSync.skipped[0].reason, /案件キー・taskIdがない/);
});
t('GitHub の確認済み事実（2026-10-16 の Desktop版Work 実機・Claude Code 再確認）：16件中5件。資料・記録の件数と名前が一致し、古い件数が混ざっていない', () => {
  const FOUND = ['AI-memo', 'New-Sales-Cases', 'Weekly-Tasks', 'external-voice-poc', 'Aegis-Mesh'];
  const NOT = ['AI-Development-Law', 'trend-report-site', 'shopping-list', 'management-AImemo', 'dialysis-weight-app', 'shpping-list', 'sogoten2026', 'salesAI', 'promptory', 'recipe-vault', 'ComprehensiveFortuneTelling'];
  assert.strictEqual(FOUND.length + NOT.length, 16);
  const cases = read('docs/AI_CASES.md'), tc = read('tasks/TASK_CURRENT.md');
  const sect = tc.slice(tc.indexOf('## AI案件の自動発見と案件キーの継承'), tc.indexOf('## 現在工程'));
  [cases, sect].forEach((d, n) => {
    assert.ok(/リポジトリ(16件|総数：16)/.test(d) && d.includes('5件'), n);
    FOUND.forEach(r => assert.ok(d.includes(r), n + '：' + r));
    NOT.forEach(r => assert.ok(d.includes(r), n + '：' + r));
    assert.ok(!/3件|読取成功3|存在3/.test(d), n + '：古い件数（3件）');
  });
});
t('保存先・報告（件数の内訳・404以外のエラー・前回あって今回見つからない案件）', () => {
  assert.ok(weekly.includes('「週間タスク」フォルダ直下の「AI案件.md」へ保存してください'));
  assert.ok(daily.includes('「週間タスクボード」フォルダ直下の「AI案件_日次現在地.md」へ保存してください'));
  [weekly, daily].forEach(s => ['ローカルで見つけた件数・GitHub で見つけた件数・同じ案件と判定した件数', '404以外のエラーのリポジトリ', '前回あって今回見つからない案件'].forEach(x => assert.ok(s.includes(x), x)));
});

// ---- 10/12 の各案件：どの決まりで防ぐか（実巡回で確かめる期待値の一覧） ----
const SCENARIOS = [
  { case: '機械売上管理システム', bad: '台帳の最新記録日 2026-07-06「工程B」を現在地に採った', expect: '冒頭の欄（第1段階MVP完了判定OK・PH1-FIX-03B）を採る。工程Bは過去の記録として採らない', rule: '本文の日付付きの過去の記録（作業ログ）だけを根拠に、冒頭の欄より前の工程へ戻さない' },
  { case: '管理職AIメモ', bad: '2026-07-28「IS-01完了」を採り、IS-13 の資料と不一致にした', expect: '冒頭の欄（IS-13 系）を採る。IS-01 は過去の記録。不一致にしない', rule: '古い記録・古い資料：' },
  { case: '機械販売事例アプリ', bad: '週次＝不一致、日次＝確認済みで食い違った', expect: '週次・日次とも同じ基準Cで判定する（改訂方針書・工程3指示書が台帳の@45記録以降の時点なら実際の矛盾＝不一致）', rule: '週次の AI案件.md と日次の AI案件_日次現在地.md は、必ずこの同じ基準で判定する' },
  { case: '週間タスク・朝ブリーフ', bad: '週次で GitHub 4か所とも Cache miss で取得失敗', expect: 'GitHub連携 → ①〜③の経路を順に試し、読めた経路を「読めた経路：」に書く', rule: '次の順に読めるまで試す' },
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

// ---- 2026-10-14：案件キー（「TASK_CURRENT.md：」の行）への取得経路の混入を、発生源（巡回指示文）で防ぐ（2026-10-15：固定5件ではなく形で判定） ----
const S2 = require('../tools/case_select');
// 巡回結果（md）の「TASK_CURRENT.md：」の行が案件キーだけになっているかの判定（朝ブリーフ・週間分析が写す値）
const keyLines = md => (md.match(/^\s*-\s*TASK_CURRENT\.md：.*$/mg) || []).map(l => l.replace(/^\s*-\s*TASK_CURRENT\.md：/, '').trim());
// 動的に見つかる案件（6件目以降を含む）の例：ローカル4件＋GitHub だけの3件
const DYN = ['A', 'B', 'C', 'D'].map(f => S2.localKey('project-' + f)).concat(['Weekly-Tasks', 'repo-x', 'repo-y'].map(r => S2.githubKey('xxxinakenxxx-hash/' + r)));
t('巡回指示文（週次・日次）：「TASK_CURRENT.md：」の行は案件キーだけ。経路・エラーは「読めた経路：」の行へ', () => {
  [weekly, daily].forEach(s => {
    assert.ok(s.includes('  - TASK_CURRENT.md：（案件キー。1-5 で決めた値だけを一字も変えずに書き、後ろに何も付けない。案件キー確認不能の場合は「なし」）'));
    assert.ok(s.includes('  - 読めた経路：（GitHub で見つかった案件だけ。TASK_CURRENT.md と開発履歴を読めた経路・方法と、失敗した経路のエラー）'));
    ['  - リポジトリ：', '  - 今回読んだTASK_CURRENT.md：（今回現在地を判定した TASK_CURRENT.md のローカルの場所または GitHub の場所。要確認でどちらも読まない場合は「なし」。案件キーとは別）', '  - 同じ案件の照合：', '  - 更新日時：'].forEach(x => assert.ok(s.includes(x), x));
    assert.ok(!s.includes('  - 採用元：'));
    assert.ok(!s.includes('読めた経路を「確認元」に書く。'));
  });
  const c = criteria(weekly);
  assert.ok(c.includes('読めた経路・失敗した経路のエラーは、確認元の「読めた経路：」の行に書く（「TASK_CURRENT.md：」の行には書かない）'));
  assert.ok(c.includes('「TASK_CURRENT.md：」の行には、この場所だけを書く。場所の後ろに、読めた経路・Cache miss・取得失敗・取得方法（GitHub連携など）・その他の注記を一切付けない'));
  assert.ok(c.includes('同じ案件には毎回同じ値を使う（読んだのがローカルか GitHub かで変えない。前回の案件キーを引き継ぐ）'));
  assert.strictEqual(criteria(weekly), criteria(daily));
});
t('回帰（10/14 の日次結果）：GitHub の案件の行に経路の説明が付いていたため、案件キーの形の判定で検出できる', () => {
  const bad = 'https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md（①WebはCache miss、②～④もCache miss。GitHub連携で同一ファイルを取得）';
  assert.deepStrictEqual(keyLines('  - TASK_CURRENT.md：' + DYN[0] + '\n  - TASK_CURRENT.md：' + bad).map(S2.isCaseKey), [true, false]);
});
t('修正後の書式どおりの結果（7件＝6件目以降を含む）：「TASK_CURRENT.md：」は案件キーだけ。経路の説明は「読めた経路：」にあり混入しない', () => {
  const route = '  - 読めた経路：GitHub連携で取得（①WebはCache miss）';
  const sample = DYN.map((k, i) => '## ' + (i + 1) + '. 案件\n- 確認元：\n  - TASK_CURRENT.md：' + k + (k.startsWith('https') ? '\n  - 今回読んだTASK_CURRENT.md：' + k + '\n' + route : '\n  - 今回読んだTASK_CURRENT.md：https://github.com/xxxinakenxxx-hash/other/blob/HEAD/tasks/TASK_CURRENT.md')).join('\n');
  const v = keyLines(sample);
  assert.strictEqual(v.length, 7);
  assert.ok(v.every(S2.isCaseKey), v.join(' | '));
  assert.ok(sample.includes('Cache miss') && !v.some(x => x.includes('Cache miss')));
  // その値から作るJSON（朝ブリーフ・週間分析）は、Windowsの場所が正しくエスケープされ、読み戻すと同じ値になる
  const json = JSON.stringify({ AI案件現在地: v.map(k => ({ 案件キー: k })) });
  assert.ok(json.includes('"C:\\\\Users\\\\inamori240\\\\Documents\\\\project-A\\\\tasks\\\\TASK_CURRENT.md"'));
  assert.deepStrictEqual(JSON.parse(json).AI案件現在地.map(x => x.案件キー), DYN);
});
t('書式の資料（AI_DAILY_FORMAT・OBSIDIAN_FORMAT）も「TASK_CURRENT.md：」は場所だけ・リポジトリ・今回読んだ場所・照合・更新日時・「読めた経路：」の行あり', () => {
  const daf = read('docs/AI_DAILY_FORMAT.md'), obf = read('docs/OBSIDIAN_FORMAT.md');
  assert.ok(daf.includes('  - TASK_CURRENT.md：（ファイルの場所だけ。案件キーとして使うため、後ろに何も付けない。案件キー確認不能の場合は「なし」）'));
  assert.ok(obf.includes('  - TASK_CURRENT.md：（ファイルの場所だけ。案件キーとして使うため、後ろに何も付けない。見つからない場合は「なし」）'));
  [daf, obf].forEach(s => ['  - 読めた経路：', '  - リポジトリ：', '  - 今回読んだTASK_CURRENT.md：', '  - 同じ案件の照合：', '  - 更新日時：'].forEach(x => assert.ok(s.includes(x), x)));
});
t('週間分析の指示文：案件キーは場所だけ・2つの形（固定の一覧なし）・「\\」の重ね書き・出力前の確認・すべての案件を出す', () => {
  const wa = block(read('docs/prompts/project_weekly_analysis.md'));
  assert.ok(wa.includes('ファイルの場所（TASK_CURRENT.md で終わる部分）だけを一字も変えずに書く。場所のあとに続く括弧書き・取得経路・エラーなどの説明は「案件キー」に入れない'));
  assert.ok(wa.includes('    ・C:\\Users\\inamori240\\Documents\\（フォルダ名）\\tasks\\TASK_CURRENT.md'));
  assert.ok(wa.includes('    ・https://github.com/xxxinakenxxx-hash/（リポジトリ名）/blob/HEAD/tasks/TASK_CURRENT.md'));
  assert.ok(wa.includes('文字列の中の「\\」（Windowsの場所の区切り）は、JSONでは「\\\\」と2つ重ねて書く'));
  assert.ok(wa.includes('AI案件の「案件キー」が上のどちらかの形（TASK_CURRENT.md で終わり、説明が付いていない）であること、AI案件.md のすべての案件（件数は決まっていない。案件キー確認不能の案件は除く）がタスク案にあり、各案の「案件キー」が AI案件.md のその案件の「TASK_CURRENT.md：」の値と一字も違わないこと（「今回読んだTASK_CURRENT.md：」の値を案件キーにしない）'));
  assert.ok(wa.includes('AI案件.md の案件は、対象週に同じ案件の行がすでにあっても、必ずすべてタスク案に出す'));
  assert.ok(wa.includes('タスク名や他の案件から推測して書かない'));
});

// ---- 2026-10-22 JSON手渡しの自動化（追加改修指示書 JSON手渡し自動化 v1.1）：JSONは画面に出さず Drive のファイルへ保存する ----
const morning = block(read('docs/prompts/project_morning_brief.md'));
const analysisP = block(read('docs/prompts/project_weekly_analysis.md'));
const importSrc = read('src/Import.js');
t('日次予約（付録E）：前段の巡回のあとに【後段】があり、後段の文は朝ブリーフの指示文（付録C）と一字も違わない', () => {
  const i = daily.indexOf('\n【後段】続けて朝ブリーフを作る');
  assert.ok(i > 0, '後段がない');
  assert.ok(daily.slice(0, i).endsWith('前回あって今回見つからない案件を報告する。\n'), '前段の最後の文のあとに続いていない');
  assert.ok(daily.endsWith('\n\n' + morning), '後段の文が付録Cと一致しない');
  assert.ok(daily.slice(i).includes('上の巡回の決まり（案件の見つけ方・判定基準・書式）は、後段では使わない'));
  // 前段の判定基準は週次と同じまま（後段を足しても変わらない）
  assert.strictEqual(criteria(weekly), criteria(daily));
});
t('朝ブリーフの指示文：「朝ブリーフ.json」へ保存し、画面に出さない（上書き・.jsonのまま・同じ名前が複数なら保存しない・開き直して確かめる）', () => {
  assert.ok(morning.includes('今日の朝ブリーフを作り、Google Drive「週間タスクボード」フォルダ直下の「朝ブリーフ.json」へ保存してください。JSONは画面に表示しないでください。'));
  assert.ok(morning.includes('既存の「朝ブリーフ.json」があれば、その同じファイルに上書きする'));
  assert.ok(morning.includes('ファイルの種類は JSON（.json）のまま保存する。Googleドキュメントに変換しない'));
  assert.ok(morning.includes('同じ名前の「朝ブリーフ.json」が2つ以上ある場合は、保存も削除もせず、そのことを報告する'));
  assert.ok(morning.includes('保存したあと「朝ブリーフ.json」を開き直し、JSONとして読み込めること、「日付」が今日であることを確かめる'));
  assert.ok(morning.includes('JSONの本文は報告に貼らない'));
  assert.ok(!/結果は次のJSON形式「だけ」で出力/.test(morning), '画面に出力する旧文が残っている');
});
t('朝ブリーフの指示文：朝情報.md が当日分でないときは朝情報を使わず「取得失敗：朝情報.md が当日分ではない」と書く（§7-1、2026-10-22 確定）', () => {
  assert.ok(morning.includes('朝情報.md の「日付：」が今日でない場合'));
  assert.ok(morning.includes('「気にかけておきたいこと」に「取得失敗：朝情報.md が当日分ではない」と書く（前日の予定を今日の予定として書かない）'));
});
t('週間分析の指示文：「週間分析.json」へ保存し、画面に出さない（上書き・.jsonのまま・同じ名前が複数なら保存しない・開き直して確かめる）', () => {
  assert.ok(analysisP.includes('今週の週間分析をして、Google Drive「週間タスクボード」フォルダ直下の「週間分析.json」へ保存してください。JSONは画面に表示しないでください。'));
  assert.ok(analysisP.includes('既存の「週間分析.json」があれば、その同じファイルに上書きする'));
  assert.ok(analysisP.includes('ファイルの種類は JSON（.json）のまま保存する。Googleドキュメントに変換しない'));
  assert.ok(analysisP.includes('同じ名前の「週間分析.json」が2つ以上ある場合は、保存も削除もせず、そのことを報告する'));
  assert.ok(analysisP.includes('「対象週」が今週の月曜であることを確かめる'));
  assert.ok(!/結果は次のJSON形式「だけ」で出力/.test(analysisP), '画面に出力する旧文が残っている');
});
t('保存先・ファイル名が、取り込む側（src/Import.js）と同じ（週間タスクボード直下。Obsidian Vault には保存しない）', () => {
  assert.ok(importSrc.includes("FOLDER_ID: '1MrAlSf4NoaSTgQYQ1uNVQf-anSaO518Z'"));
  assert.ok(importSrc.includes("BRIEF_FILE: '朝ブリーフ.json'") && importSrc.includes("ANALYSIS_FILE: '週間分析.json'"));
  assert.ok(morning.includes('「週間タスク」フォルダには保存しないでください'));
  assert.ok(analysisP.includes('「週間タスク」フォルダ（Obsidian Vault）には保存しないでください'));
});
t('JSONの中身の決まり（項目・案件キー・取得結果の区別・「\\」の重ね書き）は、保存先の変更で変わっていない', () => {
  ['"日付": "（今日 yyyy-MM-dd）"', '"今日の一言"', '"AI案件現在地": [', '取得失敗の案件を「確認済み」に変えない', '案件名（タスク名）で対応付けない'].forEach(x => assert.ok(morning.includes(x), x));
  ['"対象週": "（今週の月曜 yyyy-MM-dd）"', '"見立て"', '"コーション"', '"タスク案"', '必ずすべてタスク案に出す'].forEach(x => assert.ok(analysisP.includes(x), x));
  [morning, analysisP].forEach(s => assert.ok(s.includes('JSONでは「\\\\」と2つ重ねて書く')));
});

// ---- 2026-10-26 追加改修「現在地同期改善」（項目1・3・4）：日時が新しい記載を正／実装前の案件は CHAT_CURRENT 冒頭定型欄／日次は AI案件.md を読んでよい ----
const critC = criteria(weekly);
t('現在地同期改善 項目1：判定基準C＝日時が新しい記載を正（情報源・日時の取り方・確認済み・食い違い検出の注記）。週次・日次で同じ', () => {
  assert.strictEqual(criteria(weekly), criteria(daily));
  ['C. 判定の区別（2026-10-23 改訂：日時が新しい記載を正とする）', '日時の比較（現在地を決めるとき、最初に行う）：',
    '情報源（TASK_CURRENT.md、実装前の案件の CHAT_CURRENT.md 冒頭定型欄、Drive 資料、開発履歴のコミット、前回の結果）の記載が食い違う場合は、各記載の日時（日付＋時刻）を比べ、最も新しい記載を現在地として採り、取得結果は「確認済み」（週次は「情報源整合：一致」）とする',
    '日時は、コミットは秒まで、台帳・定型欄は記載の日付＋取得できる更新時刻で比べる',
    '古い方との食い違いは、注記（日次は「内容」、週次は「要確認」）に「食い違い検出：（何と何がどう違うか）」と書く'].forEach(x => assert.ok(critC.includes(x), x));
});
t('現在地同期改善 項目1：日時がどの情報源からも取れない・最も新しい記載が同時刻で中身が違う場合だけ「不一致／要確認」で現在地を空にする', () => {
  const line = critC.split('\n').find(l => l.startsWith('  - 実際の矛盾：'));
  assert.ok(line.includes('日時の比較で決められない場合（食い違う記載のどれからも日時が取れない場合、または最も新しい記載が同時刻で中身が違う場合）だけ'));
  assert.ok(line.includes('→「不一致」（判断材料が足りず決められないときは「要確認」）。現在地は空欄にし、何と何が食い違うかを書く'));
  // 結果の区別は従来の4つのまま
  ['  - 実際の矛盾：', '  - 古い記録・古い資料：', '  - チャット未確認：', '  - 取得失敗：'].forEach(x => assert.ok(critC.includes(x), x));
  assert.ok(critC.includes('結果は次の4つのどれかに分ける。'));
});
t('現在地同期改善 項目1：判定基準B（前回より前の工程へ戻る場合は明記された巻き戻しだけ採る）の安全装置は変えず、日時優先より先に効く', () => {
  assert.ok(critC.includes('判定基準 B（前回より前の工程へ戻る場合は、明記された巻き戻しだけ採る）は変えない。日時が新しくても、前回より前の工程を示す記載は B に従う'));
  [weekly, daily].forEach(s => {
    assert.ok(s.includes('  - 前回より前の工程になる場合は、根拠が台帳の冒頭の欄で前の工程に戻したと明記されているときだけ採る（根拠を書く）。そうでなければ今回の判断を採らず、前回の現在地を書いたうえで「前回からの変化：要確認（前回より前の工程の記載あり：その記載）」とする。'));
  });
});
t('現在地同期改善 項目3：実装前の案件は CHAT_CURRENT 冒頭定型欄を根拠に加え日時比較。実装中以降は TASK_CURRENT だけ。定型欄なしは規約3-1と同じ文を注記', () => {
  const A = critC.slice(critC.indexOf('A. 現在地の決め方'), critC.indexOf('B. 前回の現在地との照合'));
  assert.ok(A.includes('実装前の案件（TASK_CURRENT.md の冒頭の欄が未着手・指示未発行・企画検討・正本整備など、実装前を示す案件）は、同じリポジトリの tasks/CHAT_CURRENT.md 冒頭の定型欄（最初の見出しの直後の「段階」「現在地」「最終更新」の3行。規約3-1）を現在地の根拠に加え'));
  assert.ok(A.includes('判定基準 C の日時の比較を行い、新しい方を現在地に採る'));
  assert.ok(A.includes('TASK_CURRENT.md の冒頭の欄が実装中以降を示す案件は、従来どおり TASK_CURRENT.md を軸にし、CHAT_CURRENT.md を現在地の根拠に加えない'));
  assert.ok(A.includes('実装前の案件で CHAT_CURRENT.md の定型欄が無い・読めない場合は、推測せず TASK_CURRENT.md だけで判定し、注記（日次は「内容」、週次は「要確認」）に「要確認（CHAT_CURRENT 定型欄なし／未更新）」と書く'));
  // 従来の A（冒頭の欄を最優先）は残っている
  assert.ok(A.includes('を最優先で現在地とする。欄に日付が無くても採る'));
  // 規約3-1 の文言と一致している
  const kiyaku = read('GitHubリポジトリ標準規約.md');
  assert.ok(kiyaku.includes('要確認（CHAT_CURRENT 定型欄なし／未更新）') && kiyaku.includes('段階：企画検討／正本整備／実装指示済み／実装中／試験・受入／運用中'));
});
t('現在地同期改善 項目3：CHAT_CURRENT.md の読み方（GitHub は①②③の読み替え、ローカルだけの案件は（フォルダ）\\tasks\\CHAT_CURRENT.md）', () => {
  assert.ok(critC.includes('CHAT_CURRENT.md（判定基準 A の実装前の案件だけ）は、GitHub の案件（GitHub と同じ案件を含む）は上の①②③の「TASK_CURRENT.md」を「CHAT_CURRENT.md」に読み替えた順に、ローカルだけの案件は（フォルダ）\\tasks\\CHAT_CURRENT.md を読む'));
});
t('現在地同期改善 項目4：日次の前段の禁止文だけを「保存しない。読むのは AI案件.md のみ可」へ変更。通常業務.md は読まない。後段（朝ブリーフ）は不変', () => {
  assert.ok(daily.includes('「週間タスク」フォルダ（Obsidian Vault）には保存しない。読むのは AI案件.md のみ可（用途：既存の案件キーの照合と、週次時点の現在地・情報源整合との突き合わせ）。通常業務.md は読まない。'));
  assert.ok(!daily.includes('には保存しない・読まないでください。'));
  const i = daily.indexOf('\n【後段】続けて朝ブリーフを作る');
  const front = daily.slice(0, i), back = daily.slice(i);
  assert.strictEqual(front.split('\n').filter(l => l.includes('Obsidian Vault')).length, 1);   // 前段で変えたのはこの1行だけ
  assert.ok(back.endsWith('\n\n' + morning));                                                    // 後段は付録Cと一字も違わない
  assert.ok(morning.includes('「週間タスク」フォルダ（Obsidian Vault）の「通常業務.md」「AI案件.md」は読まないでください。「週間タスク」フォルダには保存しないでください。'));
  assert.ok(back.includes('上の巡回の決まり（案件の見つけ方・判定基準・書式）は、後段では使わない'));
  // 朝ブリーフの材料は従来どおり（AI案件.md の内容を朝ブリーフの本文に使わない）
  assert.ok(back.includes('- Google Drive「週間タスクボード」フォルダ直下の「朝情報.md」') && back.includes('- Google Drive「週間タスクボード」フォルダ直下の「AI案件_日次現在地.md」'));
  // 週次は元から AI案件.md を保存する側。週次の保存先は変えていない
  assert.ok(weekly.includes('「週間タスク」フォルダ直下の「AI案件.md」へ保存してください'));
});
t('現在地同期改善：週間分析（付録B）は参照整合だけ。食い違い検出・CHAT_CURRENT 定型欄なしの注記だけの案件を例外情報にしない。JSON項目は不変', () => {
  assert.ok(analysisP.includes('要確認欄が「チャット未確認」「古い資料・台帳内の古い記載」「食い違い検出：…」「要確認（CHAT_CURRENT 定型欄なし／未更新）」の注記だけの案件は、例外情報にしない'));
  ['"対象週": "（今週の月曜 yyyy-MM-dd）"', '"見立て"', '"コーション"', '"タスク案"', '"タスク名"', '"種別"', '"曜日"', '"優先度"', '"重点"', '"例外情報"', '"AI案件現在地"', '"案件キー"'].forEach(x => assert.ok(analysisP.includes(x), x));
});
// 机上判定例（指示文の決まりを、サンプル台帳に当てはめる。Work の動き自体は実際の巡回結果で確かめる）
function judge(sources, opts) {
  opts = opts || {};
  const stage = sources.filter(x => x.kind === 'TASK' && x.stage)[0];
  let use = sources;
  if (stage && /実装中|試験|運用/.test(stage.stage)) use = sources.filter(x => x.kind !== 'CHAT');                // 実装中以降は TASK_CURRENT だけ
  if (use.length === 1) return { result: '確認済み', position: use[0].position, note: opts.noChatField && stage && !/実装中|試験|運用/.test(stage.stage) ? '要確認（CHAT_CURRENT 定型欄なし／未更新）' : '' };
  if (use.some(x => !x.at)) return { result: '不一致', position: '' };                                              // 日時が取れない
  const newest = use.slice().sort((a, b) => (a.at < b.at ? 1 : -1));
  if (newest[0].at === newest[1].at && newest[0].position !== newest[1].position) return { result: '不一致', position: '' };   // 同時刻で中身が違う
  const adopted = newest[0];
  if (opts.prev && opts.prev.stageNo > adopted.stageNo && !adopted.explicitRewind) return { result: '要確認', position: opts.prev.position, note: '前回より前の工程の記載あり' };   // 判定基準B
  const diff = use.filter(x => x !== adopted && x.position !== adopted.position);
  return { result: '確認済み', position: adopted.position, note: diff.length ? '食い違い検出：' + diff.map(x => x.kind + '=' + x.position).join('、') : '' };
}
t('机上判定（受入）：新販売事例＝台帳(TASK_CURRENT 10-14)とCHAT_CURRENT定型欄(10-16)の食い違い → 確認済み・現在地＝CHAT_CURRENT の内容。食い違いは注記', () => {
  const r = judge([{ kind: 'TASK', at: '2026-10-14 09:00:00', stage: '未着手', position: '指示未発行' }, { kind: 'CHAT', at: '2026-10-16 10:00:00', position: '実装指示済み（IS-00）' }]);
  assert.deepStrictEqual([r.result, r.position], ['確認済み', '実装指示済み（IS-00）']);
  assert.ok(r.note.startsWith('食い違い検出：'));
});
t('机上判定：日時が取れない／同時刻で中身が違う → 従来どおり不一致で現在地を空にする', () => {
  assert.deepStrictEqual(Object.assign({}, judge([{ kind: 'TASK', at: '2026-10-14 09:00:00', stage: '未着手', position: 'A' }, { kind: 'CHAT', at: '', position: 'B' }])), { result: '不一致', position: '' });
  assert.deepStrictEqual(Object.assign({}, judge([{ kind: 'TASK', at: '2026-10-16 10:00:00', stage: '未着手', position: 'A' }, { kind: 'CHAT', at: '2026-10-16 10:00:00', position: 'B' }])), { result: '不一致', position: '' });
});
t('机上判定：巻き戻し安全装置（日時が新しくても、明記されない前の工程は採らず前回の現在地＋要確認）', () => {
  const r = judge([{ kind: 'TASK', at: '2026-10-14 09:00:00', stage: '未着手', position: 'IS-03', stageNo: 3 }, { kind: 'CHAT', at: '2026-10-16 10:00:00', position: 'IS-01', stageNo: 1 }], { prev: { stageNo: 3, position: 'IS-03' } });
  assert.deepStrictEqual([r.result, r.position], ['要確認', 'IS-03']);
  const ok = judge([{ kind: 'TASK', at: '2026-10-14 09:00:00', stage: '未着手', position: 'IS-03', stageNo: 3 }, { kind: 'CHAT', at: '2026-10-16 10:00:00', position: 'IS-01', stageNo: 1, explicitRewind: true }], { prev: { stageNo: 3, position: 'IS-03' } });
  assert.strictEqual(ok.position, 'IS-01');
});
t('机上判定：実装中以降の案件は CHAT_CURRENT を根拠にしない。実装前で定型欄が無ければ注記して TASK_CURRENT だけで判定', () => {
  const impl = judge([{ kind: 'TASK', at: '2026-10-14 09:00:00', stage: '実装中', position: 'IS-02 実装中' }, { kind: 'CHAT', at: '2026-10-20 10:00:00', position: '別の内容' }]);
  assert.strictEqual(impl.position, 'IS-02 実装中');
  const none = judge([{ kind: 'TASK', at: '2026-10-14 09:00:00', stage: '未着手', position: '指示未発行' }], { noChatField: true });
  assert.deepStrictEqual([none.result, none.position, none.note], ['確認済み', '指示未発行', '要確認（CHAT_CURRENT 定型欄なし／未更新）']);
});

// ---- 2026-10-26 追加実装「週間入口拡充」（項目1）：通常業務の巡回を週間分析へ1本化（通常業務.md を週次経路から廃止） ----
t('週間入口拡充 項目1：付録Bは Gmail・Googleカレンダー・Drive を直接読み、ストックの未採用を材料に加える。通常業務.md の読み取りは指示文から削除', () => {
  ['- Gmail：今週対応が必要そうな依頼・期限・要確認事項（直接読む）', '- Googleカレンダー：今週の予定のうち、準備・対応のタスクが要るもの（直接読む）', '- Google Drive：今週関係する資料（直接読む）'].forEach(x => assert.ok(analysisP.includes(x), x));
  assert.ok(analysisP.includes('「ストック」シート（状態が「未採用」の行。内容・書いた日・出どころ・希望週。読むだけで変更しない）'));
  assert.ok(!analysisP.includes('通常業務.md'));
  assert.ok(analysisP.includes('Google Drive「週間タスクボード」フォルダ内「週間タスク」フォルダ直下の「AI案件.md」'));   // AI案件の材料は従来どおり
  assert.ok(analysisP.includes('Gmail・Googleカレンダー・Google Drive・ストックから抽出した事項は 通常タスク'));
  assert.ok(analysisP.includes('「週間タスク」フォルダ（Obsidian Vault）には保存しないでください'));
});
t('週間入口拡充 項目1：抽出したものは従来どおり「タスク案」（通常タスク）。JSON項目・保存先・AI案件の2段構成（5:45巡回→7:00分析）は変えない', () => {
  assert.ok(analysisP.includes('{"タスク名": "...", "種別": "通常タスク", "曜日": "木", "優先度": 1, "重点": true, "例外情報": ""}'));
  assert.ok(analysisP.includes('"AI案件現在地": "現在工程・工程状態・次にやる具体作業・現在の手番の要約", "案件キー": "AI案件.md に記載された TASK_CURRENT.md の場所"}'));
  assert.ok(analysisP.includes('今週の週間分析をして、Google Drive「週間タスクボード」フォルダ直下の「週間分析.json」へ保存してください。'));
  const head = read('docs/prompts/project_weekly_analysis.md').split('```')[0];
  assert.ok(head.includes('デスクトップ版Work（AI案件.md）の保存が終わったあと'));
  assert.ok(head.includes('通常業務.md は読まない。ファイル自体は削除しない'));
  assert.ok(!head.includes('Web版Work（通常業務.md）'));
});
t('週間入口拡充 項目1：ほかの指示文（日次・週次巡回・朝ブリーフ・朝情報）は通常業務の巡回の変更に影響されない。付録Aの本文は変えない', () => {
  assert.ok(!weekly.includes('Gmail') && !daily.includes('ストック') && !morning.includes('ストック'));
  const a = block(read('docs/prompts/web_work_weekly.md'));
  assert.ok(a.includes('通常業務'));
  assert.ok(!read('docs/prompts/web_work_weekly.md').includes('運用は終了'));      // 付録Aの注記はマニュアル側に置く（指示文ファイルは触らない）
  const m = read('src/view_manual.html');
  assert.ok(m.includes('<p class="note">この指示文の運用は終了（週間入口拡充により週間分析へ1本化）。</p>'));
  assert.ok(m.indexOf('この指示文の運用は終了') > m.indexOf('付録A') && m.indexOf('この指示文の運用は終了') < m.indexOf('id="appendix-a"'));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
