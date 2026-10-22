// JSON手渡しの自動化（追加改修指示書 JSON手渡し自動化 v1.1 §3.3・§5）のテスト：node tests/import.test.js
// Drive の 朝ブリーフ.json・週間分析.json を GAS が読み、種別判別・検証・二重取込防止・補正・失敗時の扱いを確かめる
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }

const TODAY = '2026-10-21', WEEK = '2026-10-19', AT = TODAY + ' 06:50';
const FOLDER = '1MrAlSf4NoaSTgQYQ1uNVQf-anSaO518Z';
const KEY_LOCAL = 'C:\\Users\\inamori240\\Documents\\project-a\\tasks\\TASK_CURRENT.md';
const KEY_GH = 'https://github.com/xxxinakenxxx-hash/repo-b/blob/HEAD/tasks/TASK_CURRENT.md';

// 「今日」を固定する（Asia/Tokyo の 2026-10-21 07:00）
function setup(now) {
  const g = load();
  const fixed = new Date((now || TODAY + 'T07:00:00') + '+09:00').getTime();
  const RealDate = Date;
  g.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } };
  g.setupSheets();
  const ids = {
    a: g.createTask({ targetWeek: WEEK, title: '案件A', kind: 'AI案件', caseKey: KEY_LOCAL, aiPosition: '前の現在地A' }).taskId,
    b: g.createTask({ targetWeek: WEEK, title: '案件B', kind: 'AI案件', caseKey: KEY_GH, aiPosition: '前の現在地B' }).taskId,
    n: g.createTask({ targetWeek: WEEK, title: '通常の作業', kind: '通常タスク', day: '火' }).taskId
  };
  return { g, ids };
}
function briefJson(over) {
  const d = {
    日付: TODAY, 今日の一言: '今日は確認が中心', 今日の流れ: ['09:00 朝礼'], 今日優先すること: ['通常の作業'], 気にかけておきたいこと: ['不一致：案件B／資料が古い'],
    もう片づいていること: [], '未完了・持越し': [],
    AI案件現在地: [
      { 案件キー: KEY_LOCAL, taskId: '', 案件名: '案件A', 取得結果: '確認済み', 現在地: 'IS-03 実装中', 取得日時: AT, 内容: '' },
      { 案件キー: KEY_GH, taskId: '', 案件名: '案件B', 取得結果: '不一致', 現在地: '', 取得日時: AT, 内容: '資料が古い' }
    ]
  };
  if (over) over(d);
  return d;
}
function analysisJson(over) {
  const d = {
    対象週: WEEK, 見立て: '今週は確認が中心', コーション: ['期限接近：資料提出'],
    タスク案: [{ タスク名: '資料提出', 種別: '通常タスク', 曜日: ['水', '木'], 優先度: 1, 重点: true, 例外情報: '' },
      { タスク名: '案件A', 種別: 'AI案件', 曜日: '', 優先度: 2, 重点: false, 例外情報: '', AI案件現在地: 'IS-03', 案件キー: KEY_LOCAL }]
  };
  if (over) over(d);
  return d;
}
function putFile(g, name, text, updated, id) {
  g.__drive.files.push({ id: id || 'F-' + name + '-' + g.__drive.files.length, name, text, updated: new Date((updated || TODAY + 'T06:52:00') + '+09:00') });
}
const snapshot = g => JSON.stringify(['タスク', '履歴', '朝ブリーフ', '週間分析'].map(n => g.__sheets[n] ? g.__sheets[n].data : null));
const briefRows = g => (g.__sheets['朝ブリーフ'] ? g.__sheets['朝ブリーフ'].data.length - 1 : 0);
const row = (g, id) => g.getTasks(WEEK).find(x => x.taskId === id);

// ---- 種別の自動判別（§3.2・§5：朝ブリーフ／週間分析／どちらでもない、の3通り。両方も） ----
t('種別判別：「日付」＋「今日の一言」は朝ブリーフ、「対象週」＋「見立て」は週間分析', () => {
  const { g } = setup();
  assert.strictEqual(g.importKind_(briefJson()).kind, 'brief');
  assert.strictEqual(g.importKind_(analysisJson()).kind, 'analysis');
});
t('種別判別：どちらにも当たらない・両方に当たるJSONは取り込まず、理由を返す', () => {
  const { g } = setup();
  assert.match(g.importKind_({ 日付: TODAY }).error, /どちらの項目もない/);
  assert.match(g.importKind_(Object.assign(briefJson(), analysisJson())).error, /両方の項目がある/);
});
t('種別が違う：朝ブリーフ.json の中身が週間分析なら取り込まない（2つの欄の取り違えと同じ事故を起こさない）', () => {
  const { g } = setup();
  putFile(g, '朝ブリーフ.json', JSON.stringify(analysisJson()));
  const before = snapshot(g);
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込失敗');
  assert.match(rec.reason, /中身が週間分析/);
  assert.strictEqual(snapshot(g), before);
});
t('種別が違う：週間分析.json の中身が朝ブリーフなら「案」にしない', () => {
  const { g } = setup();
  putFile(g, '週間分析.json', JSON.stringify(briefJson()));
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.draft, null);
  assert.match(r.status.reason, /中身が朝ブリーフ/);
});

// ---- 朝ブリーフ：トリガー取込は従来の貼付保存と同じ結果（§5） ----
t('朝ブリーフ：トリガー取込で「朝ブリーフ」シート保存・AI案件現在地同期・履歴が、貼付保存（saveMorningBrief）と同じになる', () => {
  const a = setup(), b = setup();
  putFile(a.g, '朝ブリーフ.json', JSON.stringify(briefJson(), null, 2));
  const rec = a.g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込済み');
  assert.strictEqual(JSON.stringify(rec.aiSync), JSON.stringify({ synced: 1, recorded: 1, unchanged: 0, skipped: 0 }));
  // 画面の貼付保存と同じ変換（src/brief.html の parseBrief）で保存したもの
  const d = briefJson();
  b.g.saveMorningBrief({ date: d['日付'], oneLine: d['今日の一言'], flow: d['今日の流れ'], priorities: d['今日優先すること'], concerns: d['気にかけておきたいこと'], done: d['もう片づいていること'], carryover: d['未完了・持越し'],
    aiPositions: d['AI案件現在地'].map(x => ({ taskId: x.taskId, caseKey: x['案件キー'], title: x['案件名'], result: x['取得結果'], position: x['現在地'], at: x['取得日時'], note: x['内容'] })) });
  assert.strictEqual(snapshot(a.g), snapshot(b.g));
  assert.strictEqual(row(a.g, a.ids.a).aiPosition, 'IS-03 実装中');
  assert.strictEqual(row(a.g, a.ids.b).aiPosition, '前の現在地B');
  assert.ok(String(row(a.g, a.ids.b).aiLatestResult).startsWith('不一致：'));
  assert.deepStrictEqual(a.g.__drive.folderIds, [FOLDER]);
});
t('朝ブリーフ：画面を開くと、取り込んだ朝ブリーフと自動取込の結果（取込済み）が表示される', () => {
  const { g } = setup();
  putFile(g, '朝ブリーフ.json', JSON.stringify(briefJson()));
  g.importBriefFromDrive();
  const res = g.getMorningBrief(TODAY);
  assert.strictEqual(res.brief.oneLine, '今日は確認が中心');
  assert.strictEqual(res.autoImport.result, '取込済み');
  assert.strictEqual(res.autoImport.fileUpdated, TODAY + ' 06:52:00');
});

// ---- 二重取込防止・ユーザー保存を上書きしない（§3.3・§5） ----
t('二重取込なし：1時間おきに何度動いても、同じ日の朝ブリーフは1行だけ・履歴も増えない', () => {
  const { g } = setup();
  putFile(g, '朝ブリーフ.json', JSON.stringify(briefJson()));
  g.importBriefFromDrive();
  const after1 = snapshot(g);
  const r2 = g.importBriefFromDrive(), r3 = g.importBriefFromDrive();
  assert.strictEqual(briefRows(g), 1);
  assert.strictEqual(snapshot(g), after1);
  assert.strictEqual(r2.result, '取込済み');
  assert.strictEqual(r3.result, '取込済み');
});
t('二重取込なし：取込済みの日は Drive を読みに行かない', () => {
  const { g } = setup();
  putFile(g, '朝ブリーフ.json', JSON.stringify(briefJson()));
  g.importBriefFromDrive();
  g.__drive.folderIds.length = 0;
  g.importBriefFromDrive();
  assert.strictEqual(g.__drive.folderIds.length, 0);
});
t('ユーザー保存を上書きしない：手動取込（非常用）で今日の分を保存済みなら、後から届いた 朝ブリーフ.json は取り込まない', () => {
  const { g } = setup();
  g.saveMorningBrief({ date: TODAY, oneLine: '手で直した一言', flow: [], priorities: [], concerns: [], done: [], carryover: [] });
  putFile(g, '朝ブリーフ.json', JSON.stringify(briefJson()));
  const before = snapshot(g);
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '何もしない');
  assert.strictEqual(snapshot(g), before);
  assert.strictEqual(g.getMorningBrief(TODAY).brief.oneLine, '手で直した一言');
});

// ---- 失敗時の扱い（§3.3・§5：ファイルなし・古い日付・解析不能・検証不合格。前回値を誤表示しない） ----
t('ファイルなし：取込失敗と理由を記録し、画面に表示する。何も保存しない', () => {
  const { g } = setup();
  const before = snapshot(g);
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込失敗');
  assert.match(rec.reason, /ファイルがありません：朝ブリーフ\.json/);
  assert.strictEqual(snapshot(g), before);
  const res = g.getMorningBrief(TODAY);
  assert.strictEqual(res.brief, null);
  assert.strictEqual(res.autoImport.result, '取込失敗');
});
t('同じ名前の .json が複数ある：取り込まず、理由（件数）を記録する（2026-10-22 確定）', () => {
  const { g } = setup();
  putFile(g, '朝ブリーフ.json', JSON.stringify(briefJson()), null, 'F1');
  putFile(g, '朝ブリーフ.json', JSON.stringify(briefJson()), null, 'F2');
  const before = snapshot(g);
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込失敗');
  assert.match(rec.reason, /同じ名前のファイルが 2 件ある/);
  assert.strictEqual(snapshot(g), before);
  putFile(g, '週間分析.json', JSON.stringify(analysisJson()), null, 'A1');
  putFile(g, '週間分析.json', JSON.stringify(analysisJson()), null, 'A2');
  const w = g.getWeeklyDraft(WEEK);
  assert.strictEqual(w.draft, null);
  assert.match(w.status.reason, /同じ名前のファイルが 2 件ある/);
});
t('古い日付：前日の 朝ブリーフ.json は今日の分として取り込まない。前日の朝ブリーフも今日の画面に出ない', () => {
  const { g } = setup();
  putFile(g, '朝ブリーフ.json', JSON.stringify(briefJson(d => { d['日付'] = '2026-10-20'; })), '2026-10-20T06:52:00');
  const before = snapshot(g);
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込失敗');
  assert.match(rec.reason, /日付（2026-10-20）が今日（2026-10-21）ではありません/);
  assert.strictEqual(snapshot(g), before);
  assert.strictEqual(g.getMorningBrief(TODAY).brief, null);
  assert.strictEqual(g.getMorningBrief('2026-10-20').brief, null);
});
t('前回値を誤表示しない：前日の自動取込の記録（取込済み）は、今日の結果として表示しない', () => {
  const { g } = setup();
  g.__props['import.brief'] = JSON.stringify({ kind: '朝ブリーフ', date: '2026-10-20', result: '取込済み', savedAt: '2026-10-20 07:00:00' });
  assert.strictEqual(g.getMorningBrief(TODAY).autoImport, null);
  assert.strictEqual(g.getMorningBrief('2026-10-20').autoImport, null);
});
t('解析不能：JSONとして読めないファイルは取込失敗（推測で補わない）', () => {
  const { g } = setup();
  putFile(g, '朝ブリーフ.json', '{"日付": "2026-10-21", "今日の一言": "途中で切れた');
  const before = snapshot(g);
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込失敗');
  assert.match(rec.reason, /JSONとして読めません/);
  assert.strictEqual(snapshot(g), before);
});
t('検証不合格：説明が付いた案件キーは取り込まず、何も書かない（貼付保存と同じ検証）', () => {
  const { g } = setup();
  putFile(g, '朝ブリーフ.json', JSON.stringify(briefJson(d => { d['AI案件現在地'][1]['案件キー'] = KEY_GH + '（GitHub連携で取得）'; })));
  const before = snapshot(g);
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込失敗');
  assert.match(rec.reason, /^検証不合格：.*案件キーは TASK_CURRENT\.md の場所です/);
  assert.strictEqual(snapshot(g), before);
});
t('検証不合格：必須項目（今日の一言）がない・配列でない項目があるJSONは取り込まない', () => {
  const { g } = setup();
  putFile(g, '朝ブリーフ.json', JSON.stringify(briefJson(d => { d['今日の一言'] = ''; d['今日の流れ'] = '09:00 朝礼'; })));
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込失敗');
  assert.match(rec.reason, /今日の一言」は必須/);
  assert.match(rec.reason, /今日の流れ」は文字列の配列/);
  assert.strictEqual(briefRows(g), 0);
});
t('失敗のあと正しいファイルに直れば、次のトリガーで取り込む', () => {
  const { g } = setup();
  putFile(g, '朝ブリーフ.json', '{壊れている', null, 'F1');
  assert.strictEqual(g.importBriefFromDrive().result, '取込失敗');
  g.__drive.files[0].text = JSON.stringify(briefJson());
  g.__drive.files[0].updated = new Date(TODAY + 'T07:30:00+09:00');
  assert.strictEqual(g.importBriefFromDrive().result, '取込済み');
  assert.strictEqual(briefRows(g), 1);
});
t('Drive を読めない（権限など）：取込失敗と理由を記録する', () => {
  const { g } = setup();
  g.__drive.error = 'アクセス権がありません';
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込失敗');
  assert.match(rec.reason, /Drive を読めません：アクセス権がありません/);
});

// ---- 文字の補正（§3.3：機械的に安全な範囲を1回だけ） ----
t('補正：コードブロック記号（```json〜```）と Markdown表示の「\\」（TASK\\_CURRENT）を外して取り込み、補正ありを記録する', () => {
  const { g } = setup();
  const text = '```json\n' + JSON.stringify(briefJson(), null, 2).split('TASK_CURRENT').join('TASK\\_CURRENT') + '\n```';
  assert.throws(() => JSON.parse(text));
  putFile(g, '朝ブリーフ.json', text);
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込済み');
  assert.strictEqual(rec.corrected, true);
  assert.strictEqual(row(g, g.getTasks(WEEK).find(x => x.title === '案件A').taskId).aiPosition, 'IS-03 実装中');
});
t('補正：Windowsの場所の「\\\\」（JSONの正しい書き方）は変えない。補正なしで読めるファイルは補正なしと記録する', () => {
  const { g } = setup();
  const text = JSON.stringify(briefJson());
  assert.ok(text.includes('C:\\\\Users\\\\inamori240'));
  assert.strictEqual(g.correctJsonText_('{"a":"C:\\\\Users\\\\x\\\\_chat\\\\TASK_CURRENT.md","b":"改行\\nあり\\"引用\\""}'), '{"a":"C:\\\\Users\\\\x\\\\_chat\\\\TASK_CURRENT.md","b":"改行\\nあり\\"引用\\""}');
  putFile(g, '朝ブリーフ.json', text);
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込済み');
  assert.strictEqual(rec.corrected, false);
  assert.strictEqual(g.getTasks(WEEK).find(x => x.title === '案件A').caseKey, KEY_LOCAL);
});
t('補正：「\\」を重ねずに書いた Windowsの場所（C:\\Users）は補正で直さず、取込失敗にする（推測で直さない）', () => {
  const { g } = setup();
  const bad = JSON.stringify(briefJson()).split('\\\\').join('\\');
  assert.throws(() => JSON.parse(bad));
  putFile(g, '朝ブリーフ.json', bad);
  const rec = g.importBriefFromDrive();
  assert.strictEqual(rec.result, '取込失敗');
  assert.match(rec.reason, /JSONとして読めません/);
  // Markdown表示の「\」が混ざっていて補正を試した場合も、場所の「\」は直さず失敗のまま
  g.__drive.files[0].text = bad.split('TASK_CURRENT').join('TASK\\_CURRENT');
  const rec2 = g.importBriefFromDrive();
  assert.strictEqual(rec2.result, '取込失敗');
  assert.match(rec2.reason, /補正後も/);
  assert.strictEqual(briefRows(g), 0);
});

// ---- 週間分析：「案」として表示し、確定前に正データの確定タスクとして扱わない（§3.2・§5） ----
t('週間分析：合格した今週の 週間分析.json は「案」として返すが、シートには何も書かない', () => {
  const { g } = setup();
  putFile(g, '週間分析.json', JSON.stringify(analysisJson()));
  const before = snapshot(g);
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.status.result, '案あり');
  assert.strictEqual(r.status.count, 2);
  assert.strictEqual(r.draft['タスク案'][0]['タスク名'], '資料提出');
  assert.strictEqual(snapshot(g), before);
  assert.ok(!g.getTasks(WEEK).some(x => x.title === '資料提出'));
  assert.strictEqual(g.getWeekBoard(WEEK).analysis, null);
});
t('週間分析：トリガーも内容を保存せず、結果（案あり）だけを記録する', () => {
  const { g } = setup();
  putFile(g, '週間分析.json', JSON.stringify(analysisJson()));
  const before = snapshot(g);
  const rec = g.importAnalysisFromDrive();
  assert.strictEqual(rec.result, '案あり');
  assert.strictEqual(snapshot(g), before);
  assert.strictEqual(JSON.parse(g.__props['import.analysis']).result, '案あり');
});
t('週間分析：画面で「確定して保存」すると従来どおり保存され、以後は「案」として出さない（確定・修正を上書きしない）', () => {
  const { g } = setup();
  putFile(g, '週間分析.json', JSON.stringify(analysisJson()));
  const d = g.getWeeklyDraft(WEEK).draft;
  // 画面の候補（ユーザーが曜日を直した）を確定
  g.commitWeekBoard(WEEK, { creates: [{ title: d['タスク案'][0]['タスク名'], kind: '通常タスク', day: '金', priority: 1, focus: true, status: '未着手' }], analysis: { outlook: d['見立て'], cautions: d['コーション'] } });
  assert.strictEqual(g.getTasks(WEEK).find(x => x.title === '資料提出').day, '金');
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.draft, null);
  assert.strictEqual(r.status.result, '確定済み');
  const after = snapshot(g);
  g.importAnalysisFromDrive();
  assert.strictEqual(snapshot(g), after);
});
t('週間分析：古い対象週・今週以外の週は「案」にしない', () => {
  const { g } = setup();
  putFile(g, '週間分析.json', JSON.stringify(analysisJson(d => { d['対象週'] = '2026-10-12'; })));
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.draft, null);
  assert.match(r.status.reason, /対象週（2026-10-12）が今週（2026-10-19）ではありません/);
  assert.strictEqual(JSON.stringify(g.getWeeklyDraft('2026-10-12')), JSON.stringify({ targetWeek: '2026-10-12', draft: null, status: null }));
});
t('週間分析：検証不合格（種別・曜日・案件キーの形）は「案」にせず、理由を返す', () => {
  const { g } = setup();
  putFile(g, '週間分析.json', JSON.stringify(analysisJson(d => { d['タスク案'][0]['種別'] = '雑務'; d['タスク案'][0]['曜日'] = '土'; d['タスク案'][1]['案件キー'] = 'repo-b.git'; })));
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.draft, null);
  ['1件目：「種別」', '1件目：「曜日」', '2件目：「案件キー」'].forEach(x => assert.ok(r.status.reason.includes(x), x));
});
t('週間分析：ファイルなし・解析不能は取込失敗（前の週の内容を今週の案として出さない）', () => {
  const { g } = setup();
  assert.match(g.getWeeklyDraft(WEEK).status.reason, /ファイルがありません：週間分析\.json/);
  putFile(g, '週間分析.json', '対象週は今週');
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.draft, null);
  assert.match(r.status.reason, /JSONとして読めません/);
});

// ---- 時間トリガー2本（1時間おき。設置関数だけを用意し、設置はユーザーの実機承認後） ----
t('時間トリガー：設置すると2本（朝ブリーフ・週間分析、1時間おき）。設置し直しても増えず、ほかのトリガーは消さない', () => {
  const { g } = setup();
  g.__triggers.push({ getHandlerFunction: () => 'otherJob' });
  assert.deepStrictEqual(g.installImportTriggers(), ['importBriefFromDrive', 'importAnalysisFromDrive']);
  g.installImportTriggers();
  assert.strictEqual(g.__triggers.length, 3);
  assert.ok(g.__triggers.filter(x => x.spec).every(x => x.spec.everyHours === 1));
  assert.strictEqual(g.removeImportTriggers(), 2);
  assert.deepStrictEqual(g.__triggers.map(x => x.getHandlerFunction()), ['otherJob']);
});
t('読み込むだけでトリガーは設置されない（設置は installImportTriggers を実行したときだけ）', () => {
  const { g } = setup();
  assert.strictEqual(g.__triggers.length, 0);
  assert.deepStrictEqual(g.listImportTriggers(), []);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
