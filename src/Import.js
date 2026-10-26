/**
 * JSON手渡しの自動化（追加改修指示書 JSON手渡し自動化 v1.1 §3.3）
 * ChatGPT（Work・Project）が Drive「週間タスクボード」直下へ保存した 朝ブリーフ.json・週間分析.json を GAS が読む。
 * - 朝ブリーフ：時間トリガーで読み、検証に合格した当日分を既存の saveMorningBrief で保存する（同期・履歴の決まりは変えない）。
 * - 週間分析：時間トリガーで読み、検証結果だけを記録する。内容はシートに保存しない（候補専用の仮テーブルを作らない）。
 *   週間画面を開いたとき、検証に合格した今週分を「案」（従来の貼付読込と同じ候補）として表示する。確定は従来どおり画面の「確定して保存」。
 * 取込の結果（成功・何もしない・失敗と理由）はスクリプトのプロパティに記録し、両画面に表示する。
 */
var IMPORT = {
  // Drive「週間タスクボード」直下（2026-10-22 ユーザー承認。朝情報.md・AI案件_日次現在地.md と同じ場所。Obsidian Vault の外）
  FOLDER_ID: '1MrAlSf4NoaSTgQYQ1uNVQf-anSaO518Z',
  BRIEF_FILE: '朝ブリーフ.json',
  ANALYSIS_FILE: '週間分析.json',
  BRIEF_PROP: 'import.brief',
  ANALYSIS_PROP: 'import.analysis',
  // 時間トリガー2本（1時間おき。§7-2）
  TRIGGER_FUNCTIONS: ['importBriefFromDrive', 'importAnalysisFromDrive']
};
// 取込の結果
var IMPORT_RESULT = { DONE: '取込済み', SKIP: '何もしない', FAIL: '取込失敗', DRAFT: '案あり', CONFIRMED: '確定済み' };
// 文字の補正（§3.3）：Markdown表示で付く「\」を外す対象の記号（JSONでは「\」のあとに来られない文字だけ）
var IMPORT_MD_ESCAPED = '_*[]()#+-.!~>|`';

/** 時間トリガー：朝ブリーフ.json を取り込む */
function importBriefFromDrive() {
  return importBrief_();
}

/** 時間トリガー：週間分析.json を確かめる（内容は保存しない。週間画面で「案」として表示する） */
function importAnalysisFromDrive() {
  var status = checkAnalysis_().status;
  // 追加実装 週間入口拡充：既存の1時間おき取込の中で、カレンダーのToDoをストックへ合流する（新しいトリガーは作らない。失敗しても上の結果は変えない）
  syncTodoToStock_();
  return status;
}

/** 時間トリガー2本を設置する（同じ関数の既存トリガーは消してから作る）。実行はユーザーの実機承認後だけ（§8） */
function installImportTriggers() {
  removeImportTriggers();
  IMPORT.TRIGGER_FUNCTIONS.forEach(function (fn) {
    ScriptApp.newTrigger(fn).timeBased().everyHours(1).create();
  });
  return listImportTriggers();
}

/** 時間トリガー2本を消す */
function removeImportTriggers() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (IMPORT.TRIGGER_FUNCTIONS.indexOf(t.getHandlerFunction()) >= 0) { ScriptApp.deleteTrigger(t); removed++; }
  });
  return removed;
}

/** 設置済みの取込トリガー（関数名の一覧） */
function listImportTriggers() {
  return ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); })
    .filter(function (fn) { return IMPORT.TRIGGER_FUNCTIONS.indexOf(fn) >= 0; });
}

// ---- 朝ブリーフ ----

function importBrief_() {
  var today = currentDate_();
  var prev = readImportStatus_(IMPORT.BRIEF_PROP);
  var rec = { kind: '朝ブリーフ', file: IMPORT.BRIEF_FILE, checkedAt: nowText_(), date: today };
  // 当日の朝ブリーフがすでに保存されていれば何もしない（自動取込済み・手動保存済みとも。ユーザーの保存を上書きしない）
  if (briefSavedDates_()[today]) {
    if (prev && prev.date === today && prev.result === IMPORT_RESULT.DONE) return prev;
    return writeImportStatus_(IMPORT.BRIEF_PROP, Object.assign(rec, { result: IMPORT_RESULT.SKIP, reason: '今日の朝ブリーフはすでに保存されています（手動保存を含む）' }));
  }
  var file = readDriveJson_(IMPORT.BRIEF_FILE);
  if (file.error) return writeImportStatus_(IMPORT.BRIEF_PROP, Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: file.error }));
  // 失敗した場合は次のトリガーで確かめ直す（一時的な読み書きの失敗で、その日の取込を止めないため）
  Object.assign(rec, { fileId: file.id, fileUpdated: file.updated });
  var parsed = parseImportJson_(file.text);
  if (parsed.error) return writeImportStatus_(IMPORT.BRIEF_PROP, Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: parsed.error }));
  rec.corrected = parsed.corrected;
  var kind = importKind_(parsed.data);
  if (kind.error) return writeImportStatus_(IMPORT.BRIEF_PROP, Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: kind.error }));
  if (kind.kind !== 'brief') return writeImportStatus_(IMPORT.BRIEF_PROP, Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: IMPORT.BRIEF_FILE + ' の中身が週間分析のJSONです（取り込みません）' }));
  var input;
  try { input = briefInputFromJson_(parsed.data); } catch (e) { return writeImportStatus_(IMPORT.BRIEF_PROP, Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: '検証不合格：' + e.message })); }
  // 古い日付・今日以外の日付は、当日分として取り込まない（前回値を最新として扱わない。IS-05）
  if (input.date !== today) return writeImportStatus_(IMPORT.BRIEF_PROP, Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: '朝ブリーフ.json の日付（' + input.date + '）が今日（' + today + '）ではありません' }));
  try {
    var res = saveMorningBrief(input);
    var s = res.aiSync || { synced: [], recorded: [], unchanged: [], skipped: [] };
    return writeImportStatus_(IMPORT.BRIEF_PROP, Object.assign(rec, {
      result: IMPORT_RESULT.DONE, savedAt: res.brief ? res.brief.savedAt : '',
      aiSync: { synced: s.synced.length, recorded: s.recorded.length, unchanged: s.unchanged.length, skipped: s.skipped.length }
    }));
  } catch (e) {
    return writeImportStatus_(IMPORT.BRIEF_PROP, Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: '検証不合格：' + e.message }));
  }
}

// 「朝ブリーフ」シートに保存済みの日付
function briefSavedDates_() {
  var sheet = openSpreadsheet_().getSheetByName(SHEETS.BRIEF.name);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  assertHeader_(sheet, SHEETS.BRIEF);
  readAll_(sheet, SHEETS.BRIEF).forEach(function (r) { out[String(r.date)] = true; });
  return out;
}

// 朝ブリーフJSON（docs/BRIEF_FORMAT.md のキー）→ saveMorningBrief へ渡す形（画面 src/brief.html の parseBrief と同じ変換・検証）
function briefInputFromJson_(data) {
  var errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data['日付'] || ''))) errors.push('「日付」は yyyy-MM-dd で指定してください。');
  if (typeof data['今日の一言'] !== 'string' || !data['今日の一言'].trim()) errors.push('「今日の一言」は必須の文字列です。');
  var out = { date: String(data['日付'] || ''), oneLine: data['今日の一言'] };
  [['今日の流れ', 'flow'], ['今日優先すること', 'priorities'], ['気にかけておきたいこと', 'concerns'], ['もう片づいていること', 'done'], ['未完了・持越し', 'carryover']].forEach(function (s) {
    var v = data[s[0]];
    if (!Array.isArray(v) || v.some(function (x) { return typeof x !== 'string'; })) errors.push('「' + s[0] + '」は文字列の配列で指定してください。');
    out[s[1]] = v || [];
  });
  var ai = data['AI案件現在地'];
  if (ai !== undefined) {
    if (!Array.isArray(ai)) errors.push('「AI案件現在地」は配列で指定してください。');
    else out.aiPositions = ai.map(function (x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return x;
      return { taskId: x['taskId'], caseKey: x['案件キー'], title: x['案件名'], result: x['取得結果'], position: x['現在地'], at: x['取得日時'], note: x['内容'] };
    });
  }
  if (errors.length) throw new Error(errors.join(' '));
  // 型・取得結果・案件キーの形などは保存処理と同じ検証（normalizeBrief_）で確かめる
  normalizeBrief_(out);
  return out;
}

// ---- 週間分析 ----

/** 週間画面用：今週の週間分析.json が検証に合格していれば「案」として返す（保存しない） */
function getWeeklyDraft(targetWeek) {
  assertWeek_(targetWeek);
  if (targetWeek !== currentWeek_()) return { targetWeek: targetWeek, draft: null, status: null };
  var r = checkAnalysis_();
  return { targetWeek: targetWeek, draft: r.data || null, status: r.status };
}

// 週間分析.json を確かめ、結果を記録する。合格した今週分は data（JSONそのもの）も返す
function checkAnalysis_() {
  var week = currentWeek_();
  var prev = readImportStatus_(IMPORT.ANALYSIS_PROP);
  var rec = { kind: '週間分析', file: IMPORT.ANALYSIS_FILE, checkedAt: nowText_(), week: week };
  // 今週の週間分析をすでに確定（「週間分析」シートに保存）していれば、案として出さない（ユーザーの確定を上書きしない）
  if (getWeekAnalysis_(week)) {
    if (prev && prev.week === week && prev.result === IMPORT_RESULT.CONFIRMED) return { status: prev };
    return { status: writeImportStatus_(IMPORT.ANALYSIS_PROP, Object.assign(rec, { result: IMPORT_RESULT.CONFIRMED, reason: '今週の週間分析は確定済みです（案として表示しません）' })) };
  }
  var fail = function (reason) { return { status: writeImportStatus_(IMPORT.ANALYSIS_PROP, Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: reason })) }; };
  var file = readDriveJson_(IMPORT.ANALYSIS_FILE);
  if (file.error) return fail(file.error);
  Object.assign(rec, { fileId: file.id, fileUpdated: file.updated, checkKey: file.id + '|' + file.updated + '|' + week });
  var parsed = parseImportJson_(file.text);
  if (parsed.error) return fail(parsed.error);
  rec.corrected = parsed.corrected;
  var kind = importKind_(parsed.data);
  if (kind.error) return fail(kind.error);
  if (kind.kind !== 'analysis') return fail(IMPORT.ANALYSIS_FILE + ' の中身が朝ブリーフのJSONです（取り込みません）');
  var errors = handoffErrors_(parsed.data);
  if (errors.length) return fail('検証不合格：' + errors.join(' '));
  if (parsed.data['対象週'] !== week) return fail('週間分析.json の対象週（' + parsed.data['対象週'] + '）が今週（' + week + '）ではありません');
  var count = parsed.data['タスク案'].length;
  // 同じファイルを確かめ直しただけなら記録を書き換えない（確認日時だけが増えないように）
  var status = prev && prev.checkKey === rec.checkKey && prev.result === IMPORT_RESULT.DRAFT ? prev
    : writeImportStatus_(IMPORT.ANALYSIS_PROP, Object.assign(rec, { result: IMPORT_RESULT.DRAFT, count: count }));
  return { status: status, data: parsed.data };
}

// 週間分析JSON（docs/HANDOFF_FORMAT.md）の検証（画面 src/weekly.html の parseHandoff と同じ決まり）
function handoffErrors_(data) {
  var errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data['対象週'] || ''))) errors.push('「対象週」は yyyy-MM-dd で指定してください。');
  if (typeof data['見立て'] !== 'string') errors.push('「見立て」は文字列で指定してください。');
  if (!Array.isArray(data['コーション'])) errors.push('「コーション」は配列で指定してください。');
  if (!Array.isArray(data['タスク案'])) errors.push('「タスク案」は配列で指定してください。');
  (Array.isArray(data['タスク案']) ? data['タスク案'] : []).forEach(function (t, i) {
    var n = (i + 1) + '件目：';
    if (!t || typeof t !== 'object') { errors.push(n + '形式が不正です。'); return; }
    if (!t['タスク名']) errors.push(n + '「タスク名」は必須です。');
    if (KIND_VALUES.indexOf(t['種別']) < 0) errors.push(n + '「種別」は ' + KIND_VALUES.join('／') + ' のいずれかです。');
    if (t['曜日'] !== undefined && t['曜日'] !== '' && !importDaysOk_(t['曜日'])) errors.push(n + '「曜日」は 月〜金（複数可）または空欄です。');
    if (t['優先度'] !== undefined && t['優先度'] !== '' && !(Number(t['優先度']) >= 1 && Number(t['優先度']) % 1 === 0)) errors.push(n + '「優先度」は1以上の整数です。');
    if (t['重点'] !== undefined && typeof t['重点'] !== 'boolean') errors.push(n + '「重点」は true／false です。');
    if (t['例外情報'] && !EXCEPTION_TYPES.some(function (e) { return String(t['例外情報']).indexOf(e + '：') === 0; })) {
      errors.push(n + '「例外情報」は「区分：内容」で、区分は ' + EXCEPTION_TYPES.join('／') + ' です。');
    }
    if (t['AI案件現在地'] !== undefined && t['AI案件現在地'] !== '') {
      if (typeof t['AI案件現在地'] !== 'string') errors.push(n + '「AI案件現在地」は文字列です。');
      else if (t['種別'] !== 'AI案件') errors.push(n + '「AI案件現在地」は種別がAI案件の場合だけ指定できます。');
    }
    if (t['案件キー'] !== undefined && t['案件キー'] !== '') {
      if (typeof t['案件キー'] !== 'string' || !/TASK_CURRENT\.md\s*$/i.test(t['案件キー'])) errors.push(n + '「案件キー」は AI案件.md に記載された TASK_CURRENT.md の場所です。');
      else if (t['種別'] !== 'AI案件') errors.push(n + '「案件キー」は種別がAI案件の場合だけ指定できます。');
    }
  });
  return errors;
}

// 「曜日」：文字列（"木"、"月,火"）または配列。月〜金だけ
function importDaysOk_(v) {
  var parts = Array.isArray(v) ? v : String(v || '').split(/[,、・\s]+/);
  return parts.every(function (p) { p = String(p).trim(); return !p || DAY_VALUES.indexOf(p) >= 0; });
}

// ---- 共通 ----

// Drive「週間タスクボード」直下の指定名のファイル。無い・同じ名前が複数ある場合は取り込まない（理由を返す）
function readDriveJson_(name) {
  var files;
  try {
    var it = DriveApp.getFolderById(IMPORT.FOLDER_ID).getFilesByName(name);
    files = [];
    while (it.hasNext()) files.push(it.next());
  } catch (e) {
    return { error: 'Drive を読めません：' + e.message };
  }
  if (!files.length) return { error: 'ファイルがありません：' + name };
  if (files.length > 1) return { error: '同じ名前のファイルが ' + files.length + ' 件あるため取り込みません：' + name };
  var f = files[0];
  return {
    id: f.getId(),
    updated: Utilities.formatDate(f.getLastUpdated(), CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'),
    text: f.getBlob().getDataAsString('UTF-8')
  };
}

// JSONとして読む。読めなければ機械的に安全な補正を1回だけ試し、それでも読めなければ失敗（推測で補わない。§3.3）
function parseImportJson_(text) {
  var s = String(text || '');
  try { return checkObject_(JSON.parse(s), false); } catch (e1) {
    var fixed = correctJsonText_(s);
    if (fixed === s) return { error: 'JSONとして読めません：' + e1.message };
    try { return checkObject_(JSON.parse(fixed), true); } catch (e2) {
      return { error: 'JSONとして読めません（補正後も）：' + e2.message };
    }
  }
}
function checkObject_(data, corrected) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'JSONの一番外側が { } ではありません' };
  return { data: data, corrected: corrected };
}

// 補正：先頭の BOM、コードブロック記号（```・```json の行）、Markdown表示で付いた「\」（例：TASK\_CURRENT）を外す。
// 「\\」の組（Windowsの場所の区切り）と、JSONで意味のある「\n」「\"」などはそのまま残す
function correctJsonText_(s) {
  var out = s.replace(/^﻿/, '').trim();
  out = out.replace(/^```[A-Za-z]*[ \t]*\r?\n/, '').replace(/\r?\n[ \t]*```[ \t]*$/, '').trim();
  out = out.replace(/\\(\\|[\s\S])/g, function (m, c) {
    return c !== '\\' && IMPORT_MD_ESCAPED.indexOf(c) >= 0 ? c : m;
  });
  return out;
}

// 種別の判別（§3.2）：「日付」＋「今日の一言」→朝ブリーフ、「対象週」＋「見立て」→週間分析。どちらにも当たらない・両方に当たる場合は取り込まない
function importKind_(data) {
  var brief = data.hasOwnProperty('日付') && data.hasOwnProperty('今日の一言');
  var analysis = data.hasOwnProperty('対象週') && data.hasOwnProperty('見立て');
  if (brief && analysis) return { error: '朝ブリーフと週間分析の両方の項目があるため、種別を決められません' };
  if (!brief && !analysis) return { error: '朝ブリーフ（日付・今日の一言）・週間分析（対象週・見立て）のどちらの項目もないため、種別を決められません' };
  return { kind: brief ? 'brief' : 'analysis' };
}

function readImportStatus_(prop) {
  var v = PropertiesService.getScriptProperties().getProperty(prop);
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return null; }
}

function writeImportStatus_(prop, rec) {
  PropertiesService.getScriptProperties().setProperty(prop, JSON.stringify(rec));
  return rec;
}

/** 画面用：朝ブリーフの自動取込の記録（今日の分だけ。前の日の記録を今日の結果として見せない） */
function briefImportStatus_() {
  var rec = readImportStatus_(IMPORT.BRIEF_PROP);
  return rec && rec.date === currentDate_() ? rec : null;
}
