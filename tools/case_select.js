// 【テスト専用】AI案件の自動発見（2026-10-15）の判定ルールの回帰テスト用ロジック。
// 本番では動かない：巡回は Desktop版Work が巡回指示文（docs/prompts/desktop_work_ai.md・desktop_work_ai_daily.md の手順1）に従って行う。
// このファイルは指示文と同じ決まりを純粋関数で書き、tests/case_select.test.js・tests/prompts.test.js で確かめるためだけに使う。
// 指示文の決まりを変えるときは、このファイルとテストも同じ内容に直す。
var OWNER = 'xxxinakenxxx-hash';
var DOCS = 'C:\\Users\\inamori240\\Documents';

// GitHub の remote URL → 'owner/repo'（小文字）。github.com 以外・形が違う・空は null
function originRepo(url) {
  var s = String(url || '').trim();
  var m = s.match(/^(?:https?:\/\/(?:[^@\/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^\/\s]+)\/([^\/\s]+?)(?:\.git)?\/?$/i);
  return m ? (m[1] + '/' + m[2]).toLowerCase() : null;
}

// 同じ案件か：ローカルの origin（無い・読めないは null/空）が、GitHub で見つかった案件 owner/repo と一致するときだけ true
function sameCase(localOrigin, githubOwnerRepo) {
  var o = originRepo(localOrigin);
  return !!o && o === String(githubOwnerRepo || '').toLowerCase();
}

// 日時（タイムゾーン付き ISO 8601。小数秒可）→ ミリ秒。タイムゾーンが無い・読めない場合は null（同じ基準で比べられないため）
function instant(s) {
  var v = String(s || '').trim();
  var m = v.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
  if (!m) return null;
  var t = Date.parse(m[1] + (m[2] ? m[2].slice(0, 4) : '') + m[3]);
  return isNaN(t) ? null : t + (m[2] && m[2].length > 4 ? Number('0.' + m[2].slice(4)) : 0);  // ミリ秒より細かい桁も比べる
}

// 同じ案件のときにどちらの TASK_CURRENT.md を読むか（ユーザー決定：更新日時が新しい方）。取れない・同じ時刻なら要確認
function chooseSource(localModifiedAt, githubCommittedAt) {
  var l = instant(localModifiedAt), g = instant(githubCommittedAt);
  if (l === null && g === null) return { source: '要確認', reason: 'ローカルと GitHub の更新日時を取れない' };
  if (l === null) return { source: '要確認', reason: 'ローカルの更新日時を取れない' };
  if (g === null) return { source: '要確認', reason: 'GitHub の更新日時を取れない' };
  if (l === g) return { source: '要確認', reason: '更新日時が同じ' };
  return { source: l > g ? 'ローカル' : 'GitHub', reason: '' };
}

function localKey(folder) { return DOCS + '\\' + folder + '\\tasks\\TASK_CURRENT.md'; }
function githubKey(ownerRepo) { return 'https://github.com/' + ownerRepo + '/blob/HEAD/tasks/TASK_CURRENT.md'; }
// 案件キーの比較（アプリの caseKeyNorm_ と同じ：前後の空白・「/」「\」・大文字小文字の違いは同じ）
function keyNorm(k) { return String(k || '').trim().replace(/\//g, '\\').toLowerCase(); }

// 有効な案件キー：アプリと同じく「TASK_CURRENT.md」で終わる値だけ（src/Store.js・src/Brief.js）。空欄・「なし」・.git の URL などは不正
function isValidKey(k) { return /TASK_CURRENT\.md$/i.test(String(k || '').trim()); }
// 名前の候補判定（2026-10-16 ユーザー決定）：名前は同じ案件を確定する根拠にしない。誤った新規採番を止めるためだけに使う。
// 「同じ・似ている」は広めにとる（大文字小文字・空白・「-」「_」の違いだけなら似ているとみなす）が、似ていても同じ案件とは確定しない
function nameNorm(s) { return String(s || '').trim().toLowerCase().replace(/[\s\u3000\-_]/g, ''); }
// キーやURLから読めるリポジトリ（owner/repo、小文字）。GitHub 形の案件キー、.git などの remote URL。読めなければ null
function keyRepo(k) {
  var m = String(k || '').trim().match(/^https:\/\/github\.com\/([^\/\s]+)\/([^\/\s]+)\/blob\/HEAD\/tasks\/TASK_CURRENT\.md$/i);
  return m ? (m[1] + '/' + m[2]).toLowerCase() : originRepo(k);
}

/**
 * 今回見つかった1案件の案件キーを決める（巡回指示文 1-5）。読む方（chooseSource の結果）は使わない。
 * found: { localFolder?, localOrigin?, githubRepo?（GitHub で tasks/TASK_CURRENT.md が見つかった owner/repo）, title?（TASK_CURRENT.md の最初の見出しの案件名） }
 * existing: 前回の結果と「タスク」シート（種別 AI案件の行）から集めた案件・行の配列 [{ key（空欄可）, repo?, name? }]（読めた分だけ）
 * sources: { previousRead: 前回の結果（AI案件.md と AI案件_日次現在地.md の両方、通常の結果）を正常に読めたか, sheetsRead: 「タスク」シートを読めたか }
 * 同じ案件を確定してよいのは強い根拠だけ：有効な既存キーが今回の場所と同じ／owner/repo が同じ（origin を正規化した owner/repo を含む）。名前は根拠にしない。
 * 返す値：{ key, rule: '引継ぎ'|'新規ローカル'|'新規GitHub'|'新規両方'|'要確認'|'案件キー確認不能',
 *          match: 'confirmedSameCase'（強い根拠で既存と同じ）|'possibleExistingCase'（名前が同じ・似ている既存の行があるが確定できない）|'newCase'（新しい案件と確定）|'undetermined'（確認元を読めず決められない）,
 *          ambiguous?, reason? }
 */
function decideKey(found, existing, sources) {
  sources = sources || {};
  var both = !!(found.localFolder && found.githubRepo);
  if (both && !sameCase(found.localOrigin, found.githubRepo)) throw new Error('origin が一致しないローカルと GitHub は別の案件として渡す');
  var repo = found.localFolder ? originRepo(found.localOrigin) : String(found.githubRepo).toLowerCase();
  var cands = [];
  if (found.localFolder) cands.push(keyNorm(localKey(found.localFolder)));
  if (repo) cands.push(keyNorm(githubKey(repo)));
  var names = [found.title, found.localFolder, repo && repo.split('/')[1]].filter(Boolean).map(nameNorm);
  var valid = [], noKey = [], possible = [];
  (existing || []).forEach(function (p) {
    var k = String(p.key || '').trim();
    var recRepo = p.repo ? String(p.repo).toLowerCase() : keyRepo(k);
    // 強い根拠：有効なキーが今回の場所と同じ、または owner/repo が同じ
    if ((isValidKey(k) && cands.indexOf(keyNorm(k)) >= 0) || (repo && recRepo === repo)) {
      if (isValidKey(k)) { if (valid.indexOf(k) < 0) valid.push(k); }
      else noKey.push(!k || k === 'なし' ? 'キー未設定' : 'キー不正');
      return;
    }
    // 名前が同じ・似ている：owner/repo が違うと分かる行は別の案件（名前で統合しない）。それ以外は「既存案件の可能性あり」
    if (p.name && names.indexOf(nameNorm(p.name)) >= 0 && !(repo && recRepo && recRepo !== repo)) possible.push(k);
  });
  var others = possible.filter(function (k) { return isValidKey(k) && valid.indexOf(k) < 0; });
  if (valid.length > 1 || (valid.length === 1 && others.length)) return { key: null, rule: '要確認', match: 'confirmedSameCase', ambiguous: valid.concat(others) };
  if (valid.length === 1) return { key: valid[0], rule: '引継ぎ', match: 'confirmedSameCase' };
  // 既存の案件だが有効なキーが無い（空欄・不正）：新しいキーを決めず、今回の場所でキーを補ったり直したりしない（2026-10-16 ユーザー決定）
  if (noKey.length) return { key: null, rule: '案件キー確認不能', match: 'confirmedSameCase', reason: noKey.join('・') };
  // 名前が同じ・似ている既存の行がある：同じ案件とは確定しないが、新しいキーも決めない（2026-10-16 ユーザー決定）
  if (possible.length) return { key: null, rule: '案件キー確認不能', match: 'possibleExistingCase', reason: '既存案件の可能性あり（名前が同じ・似ている行。同一案件とは確定しない）' };
  // 案件が見つからない：前回の結果とシートの両方を正常に確認できた場合だけ新しい案件と確定し、新しいキーを決める。
  // どちらか一方でも確認できなければ、確認できなかった側に既存の案件があるかもしれないため発行しない（2026-10-16 ユーザー決定）
  if (!(sources.previousRead && sources.sheetsRead)) return { key: null, rule: '案件キー確認不能', match: 'undetermined', reason: '確認元を読めない' };
  if (both) return { key: githubKey(found.githubRepo), rule: '新規両方', match: 'newCase' };
  if (found.localFolder) return { key: localKey(found.localFolder), rule: '新規ローカル', match: 'newCase' };
  return { key: githubKey(found.githubRepo), rule: '新規GitHub', match: 'newCase' };
}

// 案件キーの形（どちらかの形だけ。後ろに説明が付いた値は不可）
function isCaseKey(k) {
  var s = String(k);
  return /^C:\\Users\\inamori240\\Documents\\[^\\]+\\tasks\\TASK_CURRENT\.md$/.test(s) ||
    /^https:\/\/github\.com\/[^\/\s]+\/[^\/\s]+\/blob\/HEAD\/tasks\/TASK_CURRENT\.md$/.test(s);
}

module.exports = { OWNER, originRepo, sameCase, instant, chooseSource, localKey, githubKey, keyNorm, isValidKey, nameNorm, keyRepo, decideKey, isCaseKey };
