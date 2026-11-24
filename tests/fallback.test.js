// 週間分析の予備作成（2026-11-24 根本修復）のテスト：node tests/fallback.test.js
// 予約が今週分の 週間分析.json を作らなかった週に、GAS が AI案件.md などから予備の案を作り、同じファイルへ保存して読み戻しで確かめる。
// 正常時に加え、PC停止（予約が動かない）・前段（週次AI巡回）の遅れ・保存失敗・保存したのに中身が変わらない・後から予約が動いた、を確かめる
const assert = require('assert');
const { load } = require('./gas_stub');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n  ' + e.message); } }

const WEEK = '2026-11-23', PREV = '2026-11-16';
const FOLDER = '1MrAlSf4NoaSTgQYQ1uNVQf-anSaO518Z', VAULT = '1vAHdhUFYsQ86bnC_OPaWeczZU-_NhHnV';
const KEY_LOCAL = 'C:\\Users\\inamori240\\Documents\\project-a\\tasks\\TASK_CURRENT.md';
const KEY_GH = 'https://github.com/xxxinakenxxx-hash/repo-b/blob/HEAD/tasks/TASK_CURRENT.md';
const KEY_BAD = 'https://github.com/xxxinakenxxx-hash/repo-c/tasks/TASK_CURRENT.md';

function setup(now) {
  const g = load();
  let fixed = new Date(now + '+09:00').getTime();
  const RealDate = Date;
  g.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } };
  g.__setNow = n => { fixed = new Date(n + '+09:00').getTime(); };
  g.setupSheets();
  return g;
}
// 巡回指示文（付録D）の書式どおりの AI案件.md
function aiMd(week, over) {
  const cases = [
    { name: '案件A', ledger: '2026-11-23', proc: 'IS-03 実装', state: '途中', next: '画面の確認', turn: 'Claude Code', integ: '一致', check: 'なし', key: KEY_LOCAL },
    { name: '案件B', ledger: '冒頭の欄（日付なし）', proc: 'IS-05', state: '途中', next: '試験', turn: 'ユーザー', integ: '不一致', check: 'なし', mismatch: '台帳と工程表が食い違う', key: KEY_GH },
    { name: '案件C', ledger: '2026-11-20', proc: '企画', state: '途中', next: '正本作成', turn: 'ユーザー', integ: '要確認', check: '承認状態が不明', key: KEY_BAD },
    { name: '案件D', ledger: '2026-11-21', proc: '設計', state: '完了', next: '実装', turn: 'Codex', integ: '一致', check: 'なし', key: 'なし' }
  ];
  if (over) over(cases);
  return ['# AI案件', '', '対象週：' + week + '（月）〜2026-11-29（日）', '確認日：' + week, '巡回フォルダ：C:\\Users\\inamori240\\Documents', ''].concat(
    ...cases.map((c, i) => ['## ' + (i + 1) + '. ' + c.name, '- 台帳の最新記録日：' + c.ledger, '- 現在工程：' + c.proc, '- 工程状態：' + c.state,
      '- 次にやる具体作業：' + c.next, '- 現在の手番：' + c.turn, '- 情報源整合：' + c.integ, '- 要確認：' + c.check, '- 参照した情報源：',
      '  - TASK_CURRENT.md：' + c.key, '  - リポジトリ：なし', '  - 今回読んだTASK_CURRENT.md：' + c.key].concat(c.mismatch ? ['- 不一致の内容：' + c.mismatch] : []).concat(['']))
  ).join('\n');
}
function analysis(week, n) {
  return JSON.stringify({ 対象週: week, 見立て: 'ChatGPTの見立て', コーション: [], タスク案: Array.from({ length: n || 1 }, (_, i) => ({ タスク名: 'ChatGPTの案' + i, 種別: '通常タスク', 曜日: '', 優先度: 1, 重点: false, 例外情報: '' })) });
}
function put(g, folderId, name, text, updated) {
  const f = { id: 'F-' + name + '-' + g.__drive.files.length, name, text, updated: new Date(updated + '+09:00'), folderId };
  g.__drive.files.push(f);
  return f;
}
const file = (g, name) => g.__drive.files.filter(f => f.name === name && f.folderId === FOLDER);
const sheetsSnap = g => JSON.stringify(['タスク', '履歴', '週間分析', 'ストック'].map(n => g.__sheets[n] ? g.__sheets[n].data : null));

// ---- 正常時 ----
t('正常：予約が今週分を作っていれば、その案をそのまま出し、予備の案は作らない（Drive に書かない）', () => {
  const g = setup('2026-11-23T13:00:00');
  put(g, FOLDER, '週間分析.json', analysis(WEEK, 3), '2026-11-23T07:05:00');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T05:50:00');
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.status.result, '案あり');
  assert.ok(!r.status.fallback);
  assert.strictEqual(r.draft['タスク案'].length, 3);
  assert.deepStrictEqual(g.__drive.writes, []);
});

t('再現（2026-11-23週）：今週分が無く先週分のまま → 12:00 以降の確認で予備の案を作り、同じファイルへ保存・読み戻しで確認して案に出す', () => {
  const g = setup('2026-11-24T13:00:00');
  const old = analysis(PREV, 23);
  const f = put(g, FOLDER, '週間分析.json', old, '2026-11-16T09:27:06');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  const before = sheetsSnap(g);
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.status.result, '案あり');
  assert.strictEqual(r.status.fallback, true);
  assert.match(r.status.fallbackReason, /対象週（2026-11-16）が今週（2026-11-23）ではありません/);
  // 同じファイル（同じID）を更新し、中身は今週分
  assert.strictEqual(file(g, '週間分析.json').length, 1);
  assert.strictEqual(file(g, '週間分析.json')[0].id, f.id);
  const saved = JSON.parse(f.text);
  assert.strictEqual(saved['対象週'], WEEK);
  assert.strictEqual(g.handoffErrors_(saved).length, 0);
  assert.match(saved['見立て'], /^【自動作成（予備）】/);
  assert.strictEqual(r.draft['タスク案'].length, 4);
  // 上書き前の中身を退避（既存データを壊さない）
  const bk = file(g, '週間分析_退避_2026-11-16.json');
  assert.strictEqual(bk.length, 1);
  assert.strictEqual(bk[0].text, old);
  // 案を出すだけでシートは書かない（確定は画面の「確定して保存」だけ）
  assert.strictEqual(sheetsSnap(g), before);
});

t('予備の案の中身：案件キーは形どおりのものだけ写し、形が違う・なしは「案件キー確認不能」。不一致・要確認を例外情報へ', () => {
  const g = setup('2026-11-24T13:00:00');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  const d = g.getWeeklyDraft(WEEK).draft['タスク案'];
  const by = n => d.filter(x => x['タスク名'] === n)[0];
  assert.strictEqual(by('案件A')['案件キー'], KEY_LOCAL);
  assert.strictEqual(by('案件A')['例外情報'], '');
  assert.match(by('案件A')['AI案件現在地'], /現在工程：IS-03 実装／工程状態：途中／次：画面の確認／手番：Claude Code/);
  assert.strictEqual(by('案件B')['案件キー'], KEY_GH);
  assert.match(by('案件B')['例外情報'], /^不一致：台帳と工程表が食い違う/);
  assert.strictEqual(by('案件C')['案件キー'], undefined);
  assert.match(by('案件C')['例外情報'], /^要確認：承認状態が不明／要確認：案件キー確認不能：AI案件.md の場所が指定の形と違います/);
  assert.match(by('案件D')['例外情報'], /^要確認：案件キー確認不能：AI案件.md の「TASK_CURRENT.md：」が「なし」です/);
  d.forEach(x => { assert.strictEqual(x['種別'], 'AI案件'); assert.ok(Number.isInteger(x['優先度']) && x['優先度'] >= 1); });
});

t('前回とのつながり：台帳の記録が前の週の記録より古い案件は、現在地を空にして要確認（保存時に前の週の値を引き継ぐ）', () => {
  const g = setup('2026-11-24T13:00:00');
  const id = g.createTask({ targetWeek: PREV, title: '案件B', kind: 'AI案件', caseKey: KEY_GH, aiPosition: '前の現在地' }).taskId;
  g.updateTask(id, { aiLatestAt: '2026-11-22 07:07' });
  const a = g.createTask({ targetWeek: PREV, title: '案件A', kind: 'AI案件', caseKey: KEY_LOCAL, aiPosition: '前の現在地A' }).taskId;
  g.updateTask(a, { aiLatestAt: '2026-11-20 07:07' });
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  const d = g.getWeeklyDraft(WEEK).draft['タスク案'];
  const b = d.filter(x => x['タスク名'] === '案件B')[0];
  assert.strictEqual(b['AI案件現在地'], '');
  assert.match(b['例外情報'], /要確認：週次巡回の記録（台帳の最新記録日 なし）が前回の記録（2026-11-22 07:07）より古いか/);
  // 台帳 2026-11-23 は前の記録 2026-11-20 より新しいので現在地を採る
  assert.notStrictEqual(d.filter(x => x['タスク名'] === '案件A')[0]['AI案件現在地'], '');
});

t('ストック：未採用で希望週が空欄か今週のものだけ通常タスクとして入れる（今週すでに同じ名前の行があれば入れない）', () => {
  const g = setup('2026-11-24T13:00:00');
  g.addStockItem({ content: '書類の提出' });
  g.addStockItem({ content: '来週の件', hopeWeek: '2026-11-30' });
  g.addStockItem({ content: '既にある作業' });
  g.createTask({ targetWeek: WEEK, title: '既にある作業', kind: '通常タスク' });
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  const d = g.getWeeklyDraft(WEEK).draft['タスク案'].filter(x => x['種別'] === '通常タスク').map(x => x['タスク名']);
  assert.deepStrictEqual(d, ['書類の提出']);
});

t('2回目以降の確認：保存した予備の案は今週分として合格するので作り直さない（書き込みは1回だけ）', () => {
  const g = setup('2026-11-24T13:00:00');
  put(g, FOLDER, '週間分析.json', analysis(PREV), '2026-11-16T09:27:06');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  g.importAnalysisFromDrive();
  const n = g.__drive.writes.length;
  g.__setNow('2026-11-24T14:00:00'); g.importAnalysisFromDrive();
  g.__setNow('2026-11-24T15:00:00'); const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(g.__drive.writes.length, n);
  assert.strictEqual(r.status.result, '案あり');
  assert.strictEqual(file(g, '週間分析_退避_2026-11-16.json').length, 1);
});

// ---- 異常時 ----
t('PC停止（予約が月曜に動かない）：12:00 より前は予約を待ち、書かない。12:00 以降の確認で予備の案を作る', () => {
  const g = setup('2026-11-23T11:00:00');
  put(g, FOLDER, '週間分析.json', analysis(PREV), '2026-11-16T09:27:06');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  const r1 = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r1.status.result, '取込失敗');
  assert.match(r1.status.reason, /予約による今週分の作成を待っています/);
  assert.deepStrictEqual(g.__drive.writes, []);
  g.__setNow('2026-11-23T12:00:00');
  const r2 = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r2.status.fallback, true);
});

t('PC停止（ファイルが1度も作られていない）：ファイルが無い場合は新しく作って案に出す', () => {
  const g = setup('2026-11-24T13:00:00');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.status.fallback, true);
  assert.deepStrictEqual(g.__drive.writes, [['create', '週間分析.json']]);
  assert.strictEqual(JSON.parse(file(g, '週間分析.json')[0].text)['対象週'], WEEK);
});

t('前段の遅れ：AI案件.md がまだ先週分なら作らず理由を出す。今週分ができた後の確認で作る', () => {
  const g = setup('2026-11-23T13:00:00');
  put(g, FOLDER, '週間分析.json', analysis(PREV), '2026-11-16T09:27:06');
  const md = put(g, VAULT, 'AI案件.md', aiMd(PREV), '2026-11-16T06:00:00');
  const r1 = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r1.status.result, '取込失敗');
  assert.match(r1.status.reason, /前段の週次AI巡回の結果（AI案件.md）が今週分ではありません（対象週 2026-11-16）/);
  assert.deepStrictEqual(g.__drive.writes, []);
  md.text = aiMd(WEEK); md.updated = new Date('2026-11-23T14:30:00+09:00');
  g.__setNow('2026-11-23T15:00:00');
  assert.strictEqual(g.getWeeklyDraft(WEEK).status.fallback, true);
});

t('保存失敗：Drive へ書けなければ案を出さず理由を記録し、既存ファイルは変えない。次の確認で書ければ回復する', () => {
  const g = setup('2026-11-24T13:00:00');
  const old = analysis(PREV);
  const f = put(g, FOLDER, '週間分析.json', old, '2026-11-16T09:27:06');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  g.__drive.writeError = 'Rate Limit Exceeded';
  const r1 = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r1.status.result, '取込失敗');
  assert.match(r1.status.reason, /予備の案を保存できません：Rate Limit Exceeded/);
  assert.strictEqual(r1.draft, null);
  assert.strictEqual(f.text, old);
  g.__drive.writeError = null;
  g.__setNow('2026-11-24T14:00:00');
  assert.strictEqual(g.getWeeklyDraft(WEEK).status.fallback, true);
  assert.strictEqual(JSON.parse(f.text)['対象週'], WEEK);
});

t('保存失敗（書いたのに中身が変わらない）：読み戻しで気づき、案を出さない', () => {
  const g = setup('2026-11-24T13:00:00');
  put(g, FOLDER, '週間分析.json', analysis(PREV), '2026-11-16T09:27:06');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  g.__drive.writeDrop = true;
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.status.result, '取込失敗');
  assert.match(r.status.reason, /読み戻した中身が一致しません/);
  assert.strictEqual(r.draft, null);
});

t('後から予約が動いた：予約が今週分を保存し直せば、そちらを案に出す（予備の案で上書きしない）', () => {
  const g = setup('2026-11-24T13:00:00');
  const f = put(g, FOLDER, '週間分析.json', analysis(PREV), '2026-11-16T09:27:06');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  g.getWeeklyDraft(WEEK);
  f.text = analysis(WEEK, 7); f.updated = new Date('2026-11-24T13:30:00+09:00');
  g.__setNow('2026-11-24T14:00:00');
  const n = g.__drive.writes.length;
  const r = g.getWeeklyDraft(WEEK);
  assert.ok(!r.status.fallback);
  assert.strictEqual(r.draft['タスク案'].length, 7);
  assert.strictEqual(g.__drive.writes.length, n);
});

t('今週分だが壊れたJSON（予約の保存失敗など）：退避してから予備の案を作る（壊れた中身も残す）', () => {
  const g = setup('2026-11-24T13:00:00');
  const broken = '{"対象週": "2026-11-23", "見立て": "途中で切れ';
  put(g, FOLDER, '週間分析.json', broken, '2026-11-24T07:01:00');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.status.fallback, true);
  assert.match(r.status.fallbackReason, /JSONとして読めません/);
  assert.strictEqual(file(g, '週間分析_退避_2026-11-23.json')[0].text, broken);
});

t('確定済みの週：予備の案は作らず、Drive に書かない（ユーザーの確定を上書きしない）', () => {
  const g = setup('2026-11-24T13:00:00');
  put(g, FOLDER, '週間分析.json', analysis(PREV), '2026-11-16T09:27:06');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  g.commitWeekBoard(WEEK, { creates: [], updates: [], refreshes: [], analysis: { outlook: '確定した見立て', cautions: [] } });
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.status.result, '確定済み');
  assert.deepStrictEqual(g.__drive.writes, []);
});

t('同じ名前の 週間分析.json が複数：予備の案へ進まず、どのファイルも書き換えず、ファイルも増やさない', () => {
  const g = setup('2026-11-24T13:00:00');
  const a = put(g, FOLDER, '週間分析.json', analysis(PREV), '2026-11-16T09:27:06');
  const b = put(g, FOLDER, '週間分析.json', analysis(PREV, 2), '2026-11-17T09:00:00');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  const before = g.__drive.files.map(f => f.id + '|' + f.text).join('\n');
  [13, 14, 15].forEach(h => {
    g.__setNow('2026-11-24T' + h + ':00:00');
    g.importAnalysisFromDrive();
    const r = g.getWeeklyDraft(WEEK);
    assert.strictEqual(r.status.result, '取込失敗');
    assert.match(r.status.reason, /同じ名前のファイルが 2 件あるため取り込みません：週間分析.json。予備の案は作りません/);
    assert.ok(!r.status.fallback);
    assert.strictEqual(r.draft, null);
  });
  assert.deepStrictEqual(g.__drive.writes, []);
  assert.strictEqual(g.__drive.files.length, 3);
  assert.strictEqual(file(g, '週間分析.json').length, 2);
  assert.strictEqual(g.__drive.files.filter(f => /^週間分析_退避_/.test(f.name)).length, 0);
  assert.strictEqual(g.__drive.files.map(f => f.id + '|' + f.text).join('\n'), before);
  assert.ok(a.text && b.text);
});

t('重複ファイルを増やさない（1つだけのとき）：何度確かめても 週間分析.json は1つ、退避も1つのまま', () => {
  const g = setup('2026-11-24T13:00:00');
  put(g, FOLDER, '週間分析.json', analysis(PREV), '2026-11-16T09:27:06');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  for (let h = 13; h <= 20; h++) { g.__setNow('2026-11-24T' + h + ':00:00'); g.importAnalysisFromDrive(); g.getWeeklyDraft(WEEK); }
  assert.strictEqual(file(g, '週間分析.json').length, 1);
  assert.strictEqual(file(g, '週間分析_退避_2026-11-16.json').length, 1);
  assert.strictEqual(g.__drive.files.filter(f => f.folderId === FOLDER).length, 2);
});

t('ファイルなしで保存に失敗しても、次の確認で作るのは1つだけ（重複を作らない）', () => {
  const g = setup('2026-11-24T13:00:00');
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  g.__drive.writeError = 'Internal error';
  assert.strictEqual(g.getWeeklyDraft(WEEK).status.result, '取込失敗');
  assert.strictEqual(file(g, '週間分析.json').length, 0);
  g.__drive.writeError = null;
  for (let h = 14; h <= 16; h++) { g.__setNow('2026-11-24T' + h + ':00:00'); g.getWeeklyDraft(WEEK); }
  assert.strictEqual(file(g, '週間分析.json').length, 1);
});

t('Drive を読めない：予備の案も保存できないため作らない', () => {
  const g = setup('2026-11-24T13:00:00');
  g.__drive.error = 'Service unavailable';
  const r = g.getWeeklyDraft(WEEK);
  assert.strictEqual(r.status.result, '取込失敗');
  assert.match(r.status.reason, /^Drive を読めません/);
  assert.deepStrictEqual(g.__drive.writes, []);
});

t('AI案件.md が無い・複数・案件なし：予備の案を作らず理由を出す', () => {
  [[], ['x', 'y'], ['empty']].forEach(list => {
    const g = setup('2026-11-24T13:00:00');
    list.forEach(k => put(g, VAULT, 'AI案件.md', k === 'empty' ? '# AI案件\n\n対象週：' + WEEK + '（月）\n' : aiMd(WEEK), '2026-11-23T10:16:58'));
    const r = g.getWeeklyDraft(WEEK);
    assert.strictEqual(r.status.result, '取込失敗', JSON.stringify(list));
    assert.match(r.status.reason, /予備の案も作れません：AI案件.md (がありません|が 2 件あります|に案件がありません)/);
    assert.deepStrictEqual(g.__drive.writes, []);
  });
});

t('予備の案から確定して保存できる（案件キーのある案は前の週の状態を引き継ぐ。キー確認不能の案もキー空欄で保存）', () => {
  const g = setup('2026-11-24T13:00:00');
  const id = g.createTask({ targetWeek: PREV, title: '案件A', kind: 'AI案件', caseKey: KEY_LOCAL, aiPosition: '前の現在地A' }).taskId;
  g.updateTask(id, { status: '進行中' });
  put(g, VAULT, 'AI案件.md', aiMd(WEEK), '2026-11-23T10:16:58');
  const d = g.getWeeklyDraft(WEEK).draft;
  const creates = d['タスク案'].map(x => ({ title: x['タスク名'], kind: x['種別'], day: '', priority: x['優先度'], focus: x['重点'], exception: x['例外情報'], aiPosition: x['AI案件現在地'] || '', caseKey: x['案件キー'] || '', exceptionConfirmed: true }));
  const res = g.commitWeekBoard(WEEK, { creates, updates: [], refreshes: [], analysis: { outlook: d['見立て'], cautions: d['コーション'] } });
  assert.strictEqual(res.created, 4);
  const rows = g.getTasks(WEEK);
  assert.strictEqual(rows.filter(r => r.title === '案件A')[0].status, '進行中');
  assert.strictEqual(rows.filter(r => r.title === '案件D')[0].caseKey, '');
  assert.strictEqual(g.getWeeklyDraft(WEEK).status.result, '確定済み');
});

t('権限：新しいファイルは DriveApp.createFile で作る。appsscript.json に Drive の読み書き権限を明記する（2026-11-24 ユーザー承認。自動判定は読み取りのままだった）', () => {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/Import.js'), 'utf8');
  assert.ok(src.includes("DriveApp.createFile(name, text, 'application/json')"));
  assert.ok(!/getFolderById\([^)]*\)\.createFile\(/.test(src));
  assert.ok(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/appsscript.json'), 'utf8')).oauthScopes.includes('https://www.googleapis.com/auth/drive'));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
