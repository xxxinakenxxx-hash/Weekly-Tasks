// 【テスト専用ロジック tools/case_select.js】AI案件の自動発見（2026-10-15）の決まりのテスト：node tests/case_select.test.js
// 案件キーは案件の識別子で、今回どちらの TASK_CURRENT.md を読んだか（更新日時で決まる）とは別。読む方が変わってもキーは変えない
const assert = require('assert');
const S = require('../tools/case_select');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }
const OR = r => 'https://github.com/xxxinakenxxx-hash/' + r + '.git';
const READ = { previousRead: true, sheetsRead: true };        // 前回の結果・シートとも読めた
const NONE = { previousRead: false, sheetsRead: false };      // どちらも読めなかった

// ---- 同じ案件の判定（remote origin と owner/repo） ----
t('同じ案件：origin の https・ssh・.git の有無・大文字小文字の違いは同じとみなす', () => {
  ['https://github.com/xxxinakenxxx-hash/external-voice-poc.git', 'https://github.com/xxxinakenxxx-hash/external-voice-poc', 'git@github.com:xxxinakenxxx-hash/external-voice-poc.git',
    'ssh://git@github.com/xxxinakenxxx-hash/external-voice-poc.git', 'https://GitHub.com/XXXINAKENXXX-HASH/External-Voice-POC/'].forEach(u => assert.strictEqual(S.sameCase(u, 'xxxinakenxxx-hash/external-voice-poc'), true, u));
});
t('同じ案件ではない：別のリポジトリ・別の所有者・github.com 以外', () => {
  assert.strictEqual(S.sameCase(OR('management-AImemo'), 'xxxinakenxxx-hash/AI-memo'), false);
  assert.strictEqual(S.sameCase('https://github.com/someone-else/AI-memo.git', 'xxxinakenxxx-hash/AI-memo'), false);
  assert.strictEqual(S.sameCase('https://gitlab.com/xxxinakenxxx-hash/AI-memo.git', 'xxxinakenxxx-hash/AI-memo'), false);
});
t('6. origin なし（未設定）：勝手に GitHub 案件と統合しない', () => {
  assert.strictEqual(S.sameCase('', 'xxxinakenxxx-hash/New-Sales-Cases'), false);
  assert.throws(() => S.decideKey({ localFolder: '機械販売事例アプリ', localOrigin: '', githubRepo: 'xxxinakenxxx-hash/New-Sales-Cases' }, [], READ), /別の案件/);
});
t('7. origin 取得失敗（読めない・形が壊れている）：勝手に統合しない', () => {
  [undefined, null, 'not a url', 'C:\\repo'].forEach(u => assert.strictEqual(S.sameCase(u, 'xxxinakenxxx-hash/AI-memo'), false, String(u)));
  // 統合しないので、ローカルの案件と GitHub の案件は別々にキーが決まる
  assert.strictEqual(S.decideKey({ localFolder: 'machine-sales-system', localOrigin: undefined }, [], READ).key, S.localKey('machine-sales-system'));
  assert.strictEqual(S.decideKey({ githubRepo: 'xxxinakenxxx-hash/AI-memo' }, [], READ).key, S.githubKey('xxxinakenxxx-hash/AI-memo'));
});
t('8. GitHub 側の TASK_CURRENT.md が 404：ローカルだけの案件として続け、キーはローカル（origin のリポジトリは記録できる）', () => {
  const r = S.decideKey({ localFolder: '管理職AIメモ', localOrigin: OR('management-AImemo') }, [], READ);
  assert.strictEqual(r.key, S.localKey('管理職AIメモ'));
  assert.strictEqual(r.rule, '新規ローカル');
});

// ---- 更新日時の比較（どちらを読むか） ----
t('9. ローカルの日時が新しい：ローカルを読む（実機の external-voice-poc の値。小数秒・タイムゾーンをそろえて比べる）', () => {
  assert.strictEqual(S.chooseSource('2026-10-15T17:13:24.5416819+09:00', '2026-10-15T15:37:45+09:00').source, 'ローカル');
  assert.strictEqual(S.chooseSource('2026-10-15T09:00:00+09:00', '2026-10-14T23:59:00Z').source, 'ローカル');  // ローカル＝10/15 00:00Z
});
t('10. GitHub の日時が新しい：GitHub を読む', () => {
  assert.strictEqual(S.chooseSource('2026-10-15T15:37:44+09:00', '2026-10-15T06:37:45Z').source, 'GitHub');
  assert.strictEqual(S.chooseSource('2026-10-15T08:00:00+09:00', '2026-10-15T00:00:01Z').source, 'GitHub');  // ローカル＝10/14 23:00Z
});
t('11. 同じ時刻：要確認（どちらも読まない）', () => {
  const r = S.chooseSource('2026-10-15T09:00:00+09:00', '2026-10-15T00:00:00Z');
  assert.strictEqual(r.source, '要確認'); assert.match(r.reason, /同じ/);
  assert.strictEqual(S.chooseSource('2026-10-15T09:00:00.5+09:00', '2026-10-15T00:00:00.500Z').source, '要確認');
});
t('12. 片方の日時を取れない（無い・タイムゾーンなし・形が違う）：要確認', () => {
  assert.match(S.chooseSource('', '2026-10-15T00:00:00Z').reason, /ローカル/);
  assert.match(S.chooseSource('2026-10-15T09:00:00+09:00', null).reason, /GitHub/);
  assert.strictEqual(S.chooseSource('2026-10-15 09:00:00', '2026-10-15T00:00:00Z').source, '要確認');
  assert.strictEqual(S.chooseSource(undefined, undefined).source, '要確認');
});

// ---- 案件キー（識別子。読む方とは別） ----
t('1. ローカルだけの新規案件：ローカルのキーで登録し、次回も同じキー', () => {
  const r1 = S.decideKey({ localFolder: 'new-local', localOrigin: '' }, [], READ);
  assert.deepStrictEqual([r1.key, r1.rule], [S.localKey('new-local'), '新規ローカル']);
  const r2 = S.decideKey({ localFolder: 'new-local', localOrigin: '' }, [{ key: r1.key }], READ);
  assert.deepStrictEqual([r2.key, r2.rule], [r1.key, '引継ぎ']);
});
t('2. GitHub だけの新規案件：GitHub のキーで登録（既存の Weekly-Tasks のキーと同じ形）', () => {
  const r = S.decideKey({ githubRepo: 'xxxinakenxxx-hash/Weekly-Tasks' }, [], READ);
  assert.strictEqual(r.key, 'https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md');
  assert.strictEqual(r.rule, '新規GitHub');
});
t('3. GitHub だけだった案件を後日ローカルにも配置：同じ owner/repo と判定し、更新日時で読む方を選ぶが、キーは元の GitHub のまま', () => {
  const prev = [{ key: S.githubKey('xxxinakenxxx-hash/AI-memo'), repo: 'xxxinakenxxx-hash/AI-memo' }];
  const found = { localFolder: 'AIメモ作業', localOrigin: OR('AI-memo'), githubRepo: 'xxxinakenxxx-hash/AI-memo' };
  assert.strictEqual(S.sameCase(found.localOrigin, found.githubRepo), true);
  assert.strictEqual(S.chooseSource('2026-10-20T10:00:00+09:00', '2026-10-19T10:00:00+09:00').source, 'ローカル');
  const r = S.decideKey(found, prev, READ);
  assert.deepStrictEqual([r.key, r.rule], [prev[0].key, '引継ぎ']);
});
t('4. ローカルだけだった案件を後日 GitHub にも配置：同じ owner/repo と判定し、読む方を選ぶが、キーは元のローカルのまま', () => {
  const prev = [{ key: S.localKey('管理職AIメモ') }];   // 前回は GitHub 側に TASK_CURRENT.md が無かった（404）
  const found = { localFolder: '管理職AIメモ', localOrigin: OR('management-AImemo'), githubRepo: 'xxxinakenxxx-hash/management-AImemo' };
  assert.strictEqual(S.chooseSource('2026-10-20T10:00:00+09:00', '2026-10-21T10:00:00+09:00').source, 'GitHub');
  const r = S.decideKey(found, prev, READ);
  assert.deepStrictEqual([r.key, r.rule], [S.localKey('管理職AIメモ'), '引継ぎ']);
});
t('5. 既存の案件キーがある状態で読む方が切り替わっても、キーは変わらない（実機の 営業AIメモ＝external-voice-poc）', () => {
  const prev = [{ key: S.localKey('営業AIメモ') }];   // Sheets・前回の結果に登録済みのキー
  const found = { localFolder: '営業AIメモ', localOrigin: 'https://github.com/xxxinakenxxx-hash/external-voice-poc.git', githubRepo: 'xxxinakenxxx-hash/external-voice-poc' };
  ['2026-10-15T15:37:45+09:00', '2026-10-16T09:00:00+09:00'].forEach(gh => {   // ローカルが新しい日・GitHub が新しい日
    S.chooseSource('2026-10-15T17:13:24.5416819+09:00', gh);
    assert.strictEqual(S.decideKey(found, prev, READ).key, S.localKey('営業AIメモ'));
  });
});
t('GitHub だけ → ローカルにも配置 → GitHub から消えた：前回の「リポジトリ：」で引き継ぎ、キーは元の GitHub のまま', () => {
  const prev = [{ key: S.githubKey('xxxinakenxxx-hash/AI-memo'), repo: 'xxxinakenxxx-hash/AI-memo' }];
  assert.strictEqual(S.decideKey({ localFolder: 'AIメモ作業', localOrigin: OR('AI-memo') }, prev, READ).key, prev[0].key);
});
t('最初から両方で見つかった新規案件（前回なし）：リポジトリから決めた GitHub のキー。読む方には左右されない', () => {
  const r = S.decideKey({ localFolder: 'x-local', localOrigin: OR('x-repo'), githubRepo: 'xxxinakenxxx-hash/x-repo' }, [], READ);
  assert.deepStrictEqual([r.key, r.rule], [S.githubKey('xxxinakenxxx-hash/x-repo'), '新規両方']);
});
t('前回は別の案件だった2件が同じリポジトリと分かった：まとめず要確認（キーを勝手に統合しない）', () => {
  const prev = [{ key: S.localKey('a') }, { key: S.githubKey('xxxinakenxxx-hash/a-repo') }];
  const r = S.decideKey({ localFolder: 'a', localOrigin: OR('a-repo'), githubRepo: 'xxxinakenxxx-hash/a-repo' }, prev, READ);
  assert.strictEqual(r.rule, '要確認'); assert.deepStrictEqual(r.ambiguous, prev.map(p => p.key));
});
t('既存の案件キー（Sheets に登録済みのローカル4件・Weekly-Tasks）は、前回の値として引き継がれ、そのまま残る', () => {
  const { load } = require('./gas_stub');
  const items = load().CASE_KEY_BACKFILL.items;
  const prev = items.map(it => ({ key: it.caseKey })).concat([{ key: S.githubKey('xxxinakenxxx-hash/Weekly-Tasks') }]);
  items.forEach(it => { const f = it.caseKey.split('\\')[4]; assert.strictEqual(S.decideKey({ localFolder: f }, prev, READ).key, it.caseKey); });
  assert.strictEqual(S.decideKey({ githubRepo: 'xxxinakenxxx-hash/Weekly-Tasks' }, prev, READ).key, prev[prev.length - 1].key);
});
t('14. 案件キーの形：説明が付いた値・入れ子のパス・GitHub 以外は当てはまらない', () => {
  assert.ok(S.isCaseKey(S.localKey('営業AIメモ')) && S.isCaseKey(S.githubKey('xxxinakenxxx-hash/New-Sales-Cases')));
  assert.ok(!S.isCaseKey(S.githubKey('xxxinakenxxx-hash/Weekly-Tasks') + '（GitHub連携で取得）'));
  assert.ok(!S.isCaseKey(S.localKey('a') + ' Cache miss'));
  assert.ok(!S.isCaseKey('C:\\Users\\inamori240\\Documents\\a\\b\\tasks\\TASK_CURRENT.md'));
  assert.ok(!S.isCaseKey('https://gitlab.com/x/y/blob/HEAD/tasks/TASK_CURRENT.md'));
});
t('15. Windows の場所の JSON エスケープ：書いて読み戻しても同じ値', () => {
  const k = S.localKey('営業AIメモ');
  const j = JSON.stringify({ 案件キー: k });
  assert.ok(j.includes('C:\\\\Users\\\\inamori240\\\\Documents\\\\営業AIメモ\\\\tasks\\\\TASK_CURRENT.md'));
  assert.strictEqual(JSON.parse(j).案件キー, k);
  assert.throws(() => JSON.parse(j.split('\\\\').join('\\')), SyntaxError);
});

// ---- 2026-10-16 ユーザー決定：新しいキーは、前回の結果とシートの両方を確認でき、両方に不存在の場合だけ。片方でも確認不能なら発行しない ----
const ONLY_PREV = { previousRead: true, sheetsRead: false };   // シートの読取失敗
const ONLY_SHEET = { previousRead: false, sheetsRead: true };  // 前回の結果の読取失敗
const KR = r => [r.key, r.rule];
const NEWLOCAL = { localFolder: 'brand-new' }, NEWGH = { githubRepo: 'xxxinakenxxx-hash/brand-new-repo' };
t('必須1：前回の結果あり・シートあり・両方に不存在 → 新しいキーを発行できる（ローカル／GitHub／最初から両方）', () => {
  const other = [{ key: S.localKey('other') }];
  assert.deepStrictEqual(KR(S.decideKey(NEWLOCAL, other, READ)), [S.localKey('brand-new'), '新規ローカル']);
  assert.deepStrictEqual(KR(S.decideKey(NEWGH, other, READ)), [S.githubKey('xxxinakenxxx-hash/brand-new-repo'), '新規GitHub']);
  assert.deepStrictEqual(KR(S.decideKey({ localFolder: 'x', localOrigin: OR('x-repo'), githubRepo: 'xxxinakenxxx-hash/x-repo' }, other, READ)), [S.githubKey('xxxinakenxxx-hash/x-repo'), '新規両方']);
});
t('必須2：前回の結果あり・シート読取失敗 → 新しいキーを発行せず案件キー確認不能', () => {
  [NEWLOCAL, NEWGH].forEach(f => assert.deepStrictEqual(KR(S.decideKey(f, [], ONLY_PREV)), [null, '案件キー確認不能']));
});
t('必須3：前回の結果の読取失敗・シートあり → 新しいキーを発行せず案件キー確認不能', () => {
  [NEWLOCAL, NEWGH].forEach(f => assert.deepStrictEqual(KR(S.decideKey(f, [], ONLY_SHEET)), [null, '案件キー確認不能']));
});
t('必須4：両方とも読取失敗 → 新しいキーを発行せず案件キー確認不能（同じ案件のローカル＋GitHub でも）', () => {
  [NEWLOCAL, NEWGH, { localFolder: '営業AIメモ', localOrigin: OR('external-voice-poc'), githubRepo: 'xxxinakenxxx-hash/external-voice-poc' }]
    .forEach(f => assert.deepStrictEqual(KR(S.decideKey(f, [], NONE)), [null, '案件キー確認不能']));
});
t('必須5：前回の結果に既存のキーあり → シートに無く、シートを読めなくても継承する', () => {
  const ex = [{ key: S.githubKey('xxxinakenxxx-hash/New-Sales-Cases') }];   // 前回の結果から集めたキー
  const f = { localFolder: '事例アプリ作業', localOrigin: OR('New-Sales-Cases'), githubRepo: 'xxxinakenxxx-hash/New-Sales-Cases' };
  [READ, ONLY_PREV].forEach(src => assert.deepStrictEqual(KR(S.decideKey(f, ex, src)), [ex[0].key, '引継ぎ']));
});
t('必須6：シートに既存のキーあり → 前回の結果に無く、前回の結果を読めなくても継承する', () => {
  const ex = [{ key: S.localKey('営業AIメモ') }];   // シートの案件キー列から集めたキー
  const f = { localFolder: '営業AIメモ', localOrigin: OR('external-voice-poc'), githubRepo: 'xxxinakenxxx-hash/external-voice-poc' };
  [READ, ONLY_SHEET].forEach(src => assert.deepStrictEqual(KR(S.decideKey(f, ex, src)), [ex[0].key, '引継ぎ']));
});
t('必須7：前回の結果とシートから異なる既存のキーが見つかる → 新しいキーを発行せず要確認', () => {
  const ex = [{ key: S.localKey('営業AIメモ') }, { key: S.githubKey('xxxinakenxxx-hash/external-voice-poc') }];
  const r = S.decideKey({ localFolder: '営業AIメモ', localOrigin: OR('external-voice-poc'), githubRepo: 'xxxinakenxxx-hash/external-voice-poc' }, ex, READ);
  assert.strictEqual(r.key, null); assert.strictEqual(r.rule, '要確認'); assert.deepStrictEqual(r.ambiguous, ex.map(e => e.key));
});
t('必須8：読み取り元がローカル／GitHub で切り替わっても既存の案件キーは変わらない（どの確認状態でも1つ、または発行なし）', () => {
  const found = { localFolder: '営業AIメモ', localOrigin: OR('external-voice-poc'), githubRepo: 'xxxinakenxxx-hash/external-voice-poc' };
  const ex = [{ key: S.localKey('営業AIメモ') }];
  const keys = new Set();
  [READ, ONLY_PREV, ONLY_SHEET, NONE].forEach(src => ['2026-10-15T15:37:45+09:00', '2026-10-16T09:00:00+09:00'].forEach(gh => {
    S.chooseSource('2026-10-15T17:13:24.5416819+09:00', gh);
    const r = S.decideKey(found, src === NONE ? [] : ex, src);
    if (r.key) keys.add(r.key);
  }));
  assert.deepStrictEqual([...keys], [S.localKey('営業AIメモ')]);
  // GitHub だけ → 後日ローカルにも → GitHub から消える、の流れでも1つ
  const k1 = S.decideKey({ githubRepo: 'xxxinakenxxx-hash/AI-memo' }, [], READ).key;
  const k2 = S.decideKey({ localFolder: 'AI-memo', localOrigin: OR('AI-memo'), githubRepo: 'xxxinakenxxx-hash/AI-memo' }, [{ key: k1, repo: 'xxxinakenxxx-hash/AI-memo' }], READ).key;
  const k3 = S.decideKey({ localFolder: 'AI-memo', localOrigin: OR('AI-memo') }, [{ key: k2, repo: 'xxxinakenxxx-hash/AI-memo' }], ONLY_PREV).key;
  assert.ok(k1 && k1 === k2 && k2 === k3, [k1, k2, k3].join(' | '));
});
t('必須9：6件目・7件目以降の案件にも同じ決まりが働く（7件：継承・新規・確認不能が件数に関係なく決まる）', () => {
  const found = ['a', 'b', 'c', 'd'].map(f => ({ localFolder: 'p-' + f })).concat(['r5', 'r6', 'r7'].map(r => ({ githubRepo: 'xxxinakenxxx-hash/' + r })));
  const ex = [{ key: S.localKey('p-a') }, { key: S.githubKey('xxxinakenxxx-hash/r6') }];
  const both = found.map(f => S.decideKey(f, ex, READ));
  assert.strictEqual(both.length, 7);
  assert.deepStrictEqual(both.map(r => r.rule), ['引継ぎ', '新規ローカル', '新規ローカル', '新規ローカル', '新規GitHub', '引継ぎ', '新規GitHub']);
  const half = found.map(f => S.decideKey(f, ex, ONLY_PREV));
  assert.deepStrictEqual(half.map(r => r.rule), ['引継ぎ', '案件キー確認不能', '案件キー確認不能', '案件キー確認不能', '案件キー確認不能', '引継ぎ', '案件キー確認不能']);
  assert.ok(new Set(both.map(r => r.key)).size === 7);
});
t('必須10：旧条件（少なくとも一方を読めれば新規）がテスト専用ロジックに残っていない', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'tools/case_select.js'), 'utf8');
  assert.ok(!src.includes('少なくとも一方'));
  assert.ok(src.includes("if (!(sources.previousRead && sources.sheetsRead)) return { key: null, rule: '案件キー確認不能', match: 'undetermined', reason: '確認元を読めない' };"));
});

// ---- 2026-10-16 ユーザー決定：「案件なし」と「案件あり・キーなし（空欄・不正）」を分ける（Desktop版Work 実機：Aegis Mesh） ----
// ---- 2026-10-16 ユーザー決定：同じ案件を確定する根拠は「有効な既存キーが今回の場所と同じ」「owner/repo が同じ」だけ。名前は根拠にしない ----
// existing の各要素は、前回の結果の案件（key＝「TASK_CURRENT.md：」の値、repo＝「リポジトリ：」、name＝見出しの案件名）、
// またはシートの種別 AI案件の行（key＝「案件キー」列、name＝「タスク名／案件名」列。シートに repo の列は無い）
const KRM = r => [r.key, r.rule, r.match];
const AEGIS = { githubRepo: 'xxxinakenxxx-hash/Aegis-Mesh', title: 'Aegis Mesh' };
const SHEET_AEGIS_BLANK = [{ key: '', name: 'Aegis Mesh' }];   // シートに「Aegis Mesh」の案件行あり・案件キー欄は空欄（repo は分からない）
t('分離：前回の結果なし・シートにも案件なし（両方とも読めた）→ 新規案件', () => {
  const ex = [{ key: S.localKey('営業AIメモ'), name: '営業AIメモ' }, { key: '', name: '別の案件' }];
  assert.deepStrictEqual(KRM(S.decideKey(AEGIS, ex, READ)), [S.githubKey('xxxinakenxxx-hash/Aegis-Mesh'), '新規GitHub', 'newCase']);
});
t('分離：強い根拠（リポジトリ）で同じ案件と分かったがキーが空欄・「なし」→ 案件キー確認不能（新しいキーを発行しない）', () => {
  ['', '  ', 'なし', undefined].forEach(k => {
    const r = S.decideKey(AEGIS, [{ key: k, repo: 'xxxinakenxxx-hash/Aegis-Mesh', name: '別名' }], READ);
    assert.deepStrictEqual(KRM(r), [null, '案件キー確認不能', 'confirmedSameCase'], String(k)); assert.match(r.reason, /キー未設定/);
  });
});
t('分離：前回の結果に案件あり（リポジトリが同じ）・キー空欄（TASK_CURRENT.md：なし）、シートに案件なし → 案件キー確認不能', () => {
  assert.deepStrictEqual(KRM(S.decideKey(AEGIS, [{ key: 'なし', repo: 'xxxinakenxxx-hash/aegis-mesh', name: '別名' }], READ)), [null, '案件キー確認不能', 'confirmedSameCase']);
});
t('分離：片方でも読めない → 案件が見つからなくても新しいキーを発行しない', () => {
  [ONLY_PREV, ONLY_SHEET, NONE].forEach(src => assert.deepStrictEqual(KRM(S.decideKey(AEGIS, [], src)), [null, '案件キー確認不能', 'undetermined']));
});
t('分離：有効な既存のキーが1件 → 引き継ぐ（名前が同じでキーが空欄の行が別にあっても）', () => {
  const k = S.githubKey('xxxinakenxxx-hash/Aegis-Mesh');
  assert.deepStrictEqual(KRM(S.decideKey(AEGIS, [{ key: k, repo: 'xxxinakenxxx-hash/Aegis-Mesh', name: 'Aegis Mesh' }].concat(SHEET_AEGIS_BLANK), READ)), [k, '引継ぎ', 'confirmedSameCase']);
});
t('分離：有効な既存のキーが複数 → 要確認（名前が同じ・似ている行の別のキーも、まとめずに数える）', () => {
  const a = S.githubKey('xxxinakenxxx-hash/Aegis-Mesh'), b = S.localKey('Aegis-Mesh');
  const r1 = S.decideKey({ localFolder: 'Aegis-Mesh', localOrigin: OR('Aegis-Mesh'), githubRepo: 'xxxinakenxxx-hash/Aegis-Mesh' }, [{ key: a }, { key: b }], READ);
  assert.deepStrictEqual([r1.key, r1.rule, r1.ambiguous], [null, '要確認', [a, b]]);
  const c = S.localKey('aegis-old');   // 名前だけ同じで、場所もリポジトリも違うキー（ローカルのキーなので owner/repo は分からない）
  const r2 = S.decideKey(AEGIS, [{ key: a }, { key: c, name: 'Aegis Mesh' }], READ);
  assert.deepStrictEqual([r2.key, r2.rule, r2.ambiguous], [null, '要確認', [a, c]]);
});
t('分離：不正な .git の URL を有効な案件キーとして扱わない', () => {
  assert.strictEqual(S.isValidKey('https://github.com/xxxinakenxxx-hash/Aegis-Mesh.git'), false);
  assert.strictEqual(S.isCaseKey('https://github.com/xxxinakenxxx-hash/Aegis-Mesh.git'), false);
  ['C:\\Users\\inamori240\\Documents\\x\\tasks\\TASK_CURRENT.md', S.githubKey('xxxinakenxxx-hash/x')].forEach(k => assert.strictEqual(S.isValidKey(k), true, k));
  ['', 'なし', null, 'https://github.com/xxxinakenxxx-hash/x'].forEach(k => assert.strictEqual(S.isValidKey(k), false, String(k)));
  // キー欄の .git の URL のリポジトリが同じなら（強い根拠）、同じ案件の行で、キーは不正
  const r = S.decideKey(AEGIS, [{ key: 'https://github.com/xxxinakenxxx-hash/Aegis-Mesh.git', name: '旧名' }], READ);
  assert.deepStrictEqual(KRM(r), [null, '案件キー確認不能', 'confirmedSameCase']); assert.match(r.reason, /キー不正/);
});
t('分離：不正なキーを、今回見つけた TASK_CURRENT.md の URL へ自動で直さない', () => {
  const bad = 'https://github.com/xxxinakenxxx-hash/Aegis-Mesh.git';
  [READ, ONLY_PREV, ONLY_SHEET].forEach(src => {
    const r = S.decideKey({ localFolder: 'Aegis-Mesh', localOrigin: OR('Aegis-Mesh'), githubRepo: 'xxxinakenxxx-hash/Aegis-Mesh' }, [{ key: bad, name: 'Aegis Mesh' }], src);
    assert.strictEqual(r.key, null);
    [S.githubKey('xxxinakenxxx-hash/Aegis-Mesh'), S.localKey('Aegis-Mesh'), bad].forEach(k => assert.notStrictEqual(r.key, k));
  });
});

t('名前1：owner/repo が一致 → 同じ案件と確定（名前が違っても）', () => {
  const k = S.githubKey('xxxinakenxxx-hash/Aegis-Mesh');
  assert.deepStrictEqual(KRM(S.decideKey(AEGIS, [{ key: k, repo: 'xxxinakenxxx-hash/Aegis-Mesh', name: 'まったく別の名前' }], READ)), [k, '引継ぎ', 'confirmedSameCase']);
  // ローカルの origin を正規化した owner/repo と、前回の「リポジトリ：」が一致
  const lk = S.localKey('営業AIメモ');
  assert.deepStrictEqual(KRM(S.decideKey({ localFolder: '別フォルダ', localOrigin: 'git@github.com:XXXINAKENXXX-HASH/external-voice-poc.git' }, [{ key: lk, repo: 'xxxinakenxxx-hash/external-voice-poc' }], READ)), [lk, '引継ぎ', 'confirmedSameCase']);
});
t('名前2：有効な既存キーが今回の場所と同じ → 同じ案件と確定', () => {
  const lk = S.localKey('Aegis-Mesh');
  assert.deepStrictEqual(KRM(S.decideKey({ localFolder: 'Aegis-Mesh', localOrigin: '' }, [{ key: lk.toLowerCase().replace(/\\/g, '/'), name: '' }], READ)).slice(1), ['引継ぎ', 'confirmedSameCase']);
  const gk = S.githubKey('xxxinakenxxx-hash/Aegis-Mesh');
  assert.deepStrictEqual(KRM(S.decideKey(AEGIS, [{ key: gk }], READ)), [gk, '引継ぎ', 'confirmedSameCase']);
});
t('名前3：名前だけ完全一致・リポジトリ不明・キー空欄 → 同じ案件と確定しない。新しいキーも発行しない（案件キー確認不能）', () => {
  const r = S.decideKey({ localFolder: 'Sample Project', localOrigin: '', title: 'Sample Project' }, [{ key: '', name: 'Sample Project' }], READ);
  assert.deepStrictEqual(KRM(r), [null, '案件キー確認不能', 'possibleExistingCase']);
  assert.notStrictEqual(r.match, 'confirmedSameCase');
});
t('名前4：「Aegis Mesh」と「Aegis-Mesh」→ 名前だけでは同じ案件と確定しない。新しいキーも発行しない（案件キー確認不能）', () => {
  const r = S.decideKey({ githubRepo: 'xxxinakenxxx-hash/Aegis-Mesh' }, SHEET_AEGIS_BLANK, READ);   // 見出しの名前が無くても、リポジトリ名が候補名
  assert.deepStrictEqual(KRM(r), [null, '案件キー確認不能', 'possibleExistingCase']);
});
t('名前5：ABC-Test と ABC_Test → 名前を正規化しただけで同じ案件にしない（可能性ありとして採番を止めるだけ）', () => {
  const r = S.decideKey({ githubRepo: 'xxxinakenxxx-hash/ABC_Test' }, [{ key: S.localKey('ABC-Test'), name: 'ABC-Test' }], READ);
  assert.strictEqual(r.match, 'possibleExistingCase');
  assert.strictEqual(r.key, null);   // 既存のキー（ABC-Test のローカルの場所）を引き継がない
  assert.strictEqual(r.rule, '案件キー確認不能');
});
t('名前6：同じ名前でも owner/repo が違う → 別の案件。名前を理由に統合しない', () => {
  [{ key: S.githubKey('xxxinakenxxx-hash/Aegis-Mesh-old'), name: 'Aegis Mesh' }, { key: '', repo: 'someone-else/Aegis-Mesh', name: 'Aegis Mesh' },
    { key: 'https://github.com/someone-else/Aegis-Mesh.git', name: 'Aegis-Mesh' }].forEach(ex => {
    const r = S.decideKey(AEGIS, [ex], READ);
    assert.deepStrictEqual(KRM(r), [S.githubKey('xxxinakenxxx-hash/Aegis-Mesh'), '新規GitHub', 'newCase'], JSON.stringify(ex));
    assert.notStrictEqual(r.key, ex.key);
  });
});
t('名前7：前回の結果・シートとも正常に読め、同じ・似ている名前の候補も、リポジトリ・キーの対応も無い → 新規案件として初期キーを発行できる', () => {
  const ex = [{ key: S.localKey('営業AIメモ'), repo: 'xxxinakenxxx-hash/external-voice-poc', name: '営業AIメモ' }, { key: '', name: '別の案件' }];
  assert.deepStrictEqual(KRM(S.decideKey({ localFolder: 'brand-new', title: 'Brand New' }, ex, READ)), [S.localKey('brand-new'), '新規ローカル', 'newCase']);
  assert.deepStrictEqual(KRM(S.decideKey({ githubRepo: 'xxxinakenxxx-hash/brand-new-repo' }, ex, READ)), [S.githubKey('xxxinakenxxx-hash/brand-new-repo'), '新規GitHub', 'newCase']);
});
t('名前8：名前の候補はあるが強い根拠が無い → 新しいキーを発行しない（有効なキーを持つ行でも引き継がない）', () => {
  [{ key: '', name: 'Aegis Mesh' }, { key: S.localKey('aegis-old'), name: 'Aegis Mesh' }, { key: '', name: 'aegis_mesh' }].forEach(ex => {
    const r = S.decideKey(AEGIS, [ex], READ);
    assert.deepStrictEqual(KRM(r), [null, '案件キー確認不能', 'possibleExistingCase'], JSON.stringify(ex));
  });
});
t('名前9：不正な既存キー＋名前一致 → 不正なキーを直さない。案件キー確認不能', () => {
  ['TASK_CURRENT.md（GitHub連携で取得）', 'C:\\Users\\inamori240\\Documents\\Aegis-Mesh'].forEach(bad => {
    const r = S.decideKey(AEGIS, [{ key: bad, name: 'Aegis Mesh' }], READ);
    assert.deepStrictEqual(KRM(r), [null, '案件キー確認不能', 'possibleExistingCase'], bad);
    assert.notStrictEqual(r.key, S.githubKey('xxxinakenxxx-hash/Aegis-Mesh'));
  });
});
t('名前10：GitHub／ローカルの切替時の案件キーの継承は変わらない（名前の候補があっても強い根拠のキーを継承）', () => {
  const gk = S.githubKey('xxxinakenxxx-hash/AI-memo');
  const found = { localFolder: 'AIメモ作業', localOrigin: OR('AI-memo'), githubRepo: 'xxxinakenxxx-hash/AI-memo', title: 'AI-memo' };
  ['2026-10-19T10:00:00+09:00', '2026-10-21T10:00:00+09:00'].forEach(gh => {
    S.chooseSource('2026-10-20T10:00:00+09:00', gh);
    assert.deepStrictEqual(KRM(S.decideKey(found, [{ key: gk, repo: 'xxxinakenxxx-hash/AI-memo', name: 'AI-memo' }, { key: '', name: 'AI memo' }], READ)), [gk, '引継ぎ', 'confirmedSameCase']);
  });
  const lk = S.localKey('営業AIメモ');
  assert.deepStrictEqual(KRM(S.decideKey({ localFolder: '営業AIメモ', localOrigin: OR('external-voice-poc'), githubRepo: 'xxxinakenxxx-hash/external-voice-poc' }, [{ key: lk, name: '営業AIメモ' }], ONLY_PREV)), [lk, '引継ぎ', 'confirmedSameCase']);
});
t('Aegis Mesh 実機ケース（GitHub に TASK_CURRENT.md あり・前回の結果に無し・シートに「Aegis Mesh」の行あり・案件キー空欄）', () => {
  const prev = [{ key: S.githubKey('xxxinakenxxx-hash/Weekly-Tasks'), repo: 'xxxinakenxxx-hash/Weekly-Tasks', name: '週間タスク・朝ブリーフ' }];   // 前回の結果に Aegis Mesh は無い
  const r = S.decideKey(AEGIS, prev.concat(SHEET_AEGIS_BLANK), READ);
  assert.notStrictEqual(r.match, 'confirmedSameCase');      // 同一案件確定：不可（名前だけ）
  assert.strictEqual(r.match, 'possibleExistingCase');      // 既存案件の可能性：あり
  assert.strictEqual(r.key, null);                          // 新規キー発行：禁止 → 「TASK_CURRENT.md：」は「なし」、取得結果は「要確認」
  assert.notStrictEqual(r.key, S.githubKey('xxxinakenxxx-hash/Aegis-Mesh'));
  assert.strictEqual(r.rule, '案件キー確認不能');
  // 強い根拠（シートの行にリポジトリが同じ GitHub のキー）で対応が分かれば、既存の案件として確定する
  const k = S.githubKey('xxxinakenxxx-hash/Aegis-Mesh');
  assert.deepStrictEqual(KRM(S.decideKey(AEGIS, prev.concat([{ key: k, name: 'Aegis Mesh' }]), READ)), [k, '引継ぎ', 'confirmedSameCase']);
});
t('名前が似ているだけで confirmedSameCase にする処理がテスト専用ロジックに無い', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'tools/case_select.js'), 'utf8');
  const body = src.slice(src.indexOf('function decideKey'));
  // confirmedSameCase を返す前に、名前（nameNorm）による判定を使っていない
  const strong = body.slice(0, body.indexOf("if (p.name && names.indexOf"));
  assert.ok(!strong.slice(strong.indexOf('existing || []')).includes('nameNorm'));
  assert.ok(body.includes("possible.push(k)") && !/possible[\s\S]{0,80}confirmedSameCase', reason/.test(body));
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
