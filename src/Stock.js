/**
 * ストック（追加実装 週間入口拡充 項目2）
 * TODOタブの置き場。カレンダーのToDoリスト（Google ToDo）と、TODOタブでの手入力を、シート「ストック」に集める。
 * 週間分析（予約「【週間タスク】週間分析JSON生成」）が状態「未採用」の行を読み、タスク案（候補カード）に含める。
 * 候補を採用して「確定して保存」すると、タスク名がストックの「内容」と一字も違わない「未採用」の行は「採用済み」になる（commitWeekBoard の処理内）。
 * 朝ブリーフには混ぜない。ToDoとの双方向同期はしない（ToDo側で完了・削除された項目は、ストックの状態を変えず「出どころ」の注記だけで分かるようにする）。
 */
var STOCK = {
  // 取込の結果（スクリプトのプロパティ。TODOページに表示する）
  TODO_PROP: 'import.todo',
  // 出どころの注記（ToDo側の状態）
  NOTE_COMPLETED: '（ToDo側で完了）',
  NOTE_DELETED: '（ToDo側で削除）'
};

/** ストックのシートを返す（無ければ作る。見出しが定義と違えばエラーにして何も書かない） */
function stockSheet_() {
  var ss = openSpreadsheet_();
  var sheet = ss.getSheetByName(SHEETS.STOCK.name);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.STOCK.name);
    writeHeader_(sheet, SHEETS.STOCK);
  } else if (sheet.getLastRow() === 0) {
    writeHeader_(sheet, SHEETS.STOCK);
  } else {
    assertHeader_(sheet, SHEETS.STOCK);
  }
  return sheet;
}

// 作らずに探す（無ければ null）
function findStockSheet_() {
  var sheet = openSpreadsheet_().getSheetByName(SHEETS.STOCK.name);
  if (!sheet) return null;
  if (sheet.getLastRow() === 0) return null;
  assertHeader_(sheet, SHEETS.STOCK);
  return sheet;
}

// ストックの全行（row＝シート上の行番号）
function stockRows_(sheet) {
  return readAll_(sheet, SHEETS.STOCK).map(function (r, i) {
    var o = { row: i + 2 };
    SHEETS.STOCK.columns.forEach(function (c) { o[c.key] = r[c.key] === undefined || r[c.key] === null ? '' : String(r[c.key]); });
    return o;
  });
}

/**
 * TODOページを開いたとき：ToDoを取り込んでから、ストックの一覧と取込の結果を返す。
 * ToDoの取込に失敗しても一覧は返す（失敗の理由は todo に入る）。
 */
function getStockPage() {
  var todo = syncTodoToStock_();
  var sheet = findStockSheet_();
  return { items: sheet ? stockRows_(sheet) : [], todo: todo, currentWeek: currentWeek_(), loadedAt: nowText_() };
}

/** 手入力で追加する（出どころ＝手入力、状態＝未採用、書いた日＝今日）。希望週は空欄可（指定するなら月曜日） */
function addStockItem(input) {
  input = input || {};
  var content = String(input.content === undefined || input.content === null ? '' : input.content).replace(/[\r\n]+/g, ' ').trim();
  if (!content) throw new Error('内容を入力してください。');
  var hopeWeek = String(input.hopeWeek === undefined || input.hopeWeek === null ? '' : input.hopeWeek).trim();
  if (hopeWeek) assertWeek_(hopeWeek);
  return withLock_(function () {
    var sheet = stockSheet_();
    var dup = stockRows_(sheet).filter(function (r) { return r.status === '未採用' && r.content === content; });
    if (dup.length) throw new Error('同じ内容の「未採用」がすでにあります：' + content);
    var item = { content: content, writtenOn: currentDate_(), source: STOCK_SOURCE_MANUAL, hopeWeek: hopeWeek, status: '未採用', todoId: '' };
    appendObj_(sheet, SHEETS.STOCK, item);
    return { items: stockRows_(sheet), loadedAt: nowText_() };
  });
}

/**
 * 状態を変える（TODOページの「取り下げ」「未採用に戻す」）。「採用済み」は確定して保存の処理だけが付けるため、画面からは変えない。
 * 行番号の取り違え防止のため、画面が見ていた内容と同じ行だけを変える。
 */
function setStockStatus(row, expectedContent, status) {
  if (['未採用', '取り下げ'].indexOf(status) < 0) throw new Error('画面から変えられる状態は「未採用」「取り下げ」だけです：' + status);
  return withLock_(function () {
    var sheet = stockSheet_();
    var rows = stockRows_(sheet);
    var target = rows.filter(function (r) { return r.row === Number(row); })[0];
    if (!target) throw new Error('ストックの行が見つかりません。画面を読み込み直してください。');
    if (target.content !== String(expectedContent)) throw new Error('ストックの内容が画面の表示と違います。画面を読み込み直してください。');
    if (target.status === '採用済み') throw new Error('採用済みの項目は変更できません：' + target.content);
    if (target.status !== status) {
      var col = SHEETS.STOCK.columns.map(function (c) { return c.key; }).indexOf('status') + 1;
      sheet.getRange(target.row, col).setValue(status);
    }
    return { items: stockRows_(sheet), loadedAt: nowText_() };
  });
}

/**
 * 週間ボードの確定（commitWeekBoard）の処理内から呼ぶ：採用して確定した候補のタスク名と同じ内容の「未採用」を「採用済み」にする。
 * ロックは呼び出し側が取っている（ここでは取らない）。シートが無ければ何もしない。更新した行数を返す。
 */
function markStockAdopted_(titles) {
  var sheet = findStockSheet_();
  if (!sheet) return 0;
  var wanted = {};
  (titles || []).forEach(function (t) { wanted[String(t).trim()] = true; });
  var col = SHEETS.STOCK.columns.map(function (c) { return c.key; }).indexOf('status') + 1;
  var n = 0;
  stockRows_(sheet).forEach(function (r) {
    if (r.status === '未採用' && wanted[r.content]) { sheet.getRange(r.row, col).setValue('採用済み'); n++; }
  });
  return n;
}

// ---- ToDo（Google Tasks）の取込 ----

/**
 * ToDoの項目を取得する。Google Tasks連携（高度なGoogleサービス「Tasks」）を使う。
 * 返す値：[{ id（リストID/タスクID）, title, state: open／completed／deleted }]
 */
function fetchTodoItems_() {
  var out = [];
  var listToken;
  do {
    var listOpt = { maxResults: 100 };
    if (listToken) listOpt.pageToken = listToken;
    var lists = Tasks.Tasklists.list(listOpt);
    (lists.items || []).forEach(function (list) {
      var token;
      do {
        var opt = { maxResults: 100, showCompleted: true, showHidden: true, showDeleted: true };
        if (token) opt.pageToken = token;
        var res = Tasks.Tasks.list(list.id, opt);
        (res.items || []).forEach(function (t) {
          out.push({ id: list.id + '/' + t.id, title: String(t.title || '').trim(), state: t.deleted === true ? 'deleted' : t.status === 'completed' ? 'completed' : 'open' });
        });
        token = res.nextPageToken;
      } while (token);
    });
    listToken = lists.nextPageToken;
  } while (listToken);
  return out;
}

function todoSourceLabel_(state) {
  return STOCK_SOURCE_CALENDAR + (state === 'completed' ? STOCK.NOTE_COMPLETED : state === 'deleted' ? STOCK.NOTE_DELETED : '');
}

/**
 * ToDoをストックへ合流する（TODOページを開いたときと、既存の1時間おき取込トリガーの中で呼ぶ。新しいトリガーは作らない）。
 * - 未取込（ToDo側IDがストックに無い）で、完了・削除されていない項目を、出どころ＝カレンダー、状態＝未採用で追加する。
 * - 取込済みの項目は、ToDo側の状態を「出どころ」の注記（完了・削除）に反映するだけで、ストックの状態は変えない。
 * 失敗しても例外は投げず、結果（スクリプトのプロパティ import.todo）に理由を残す。
 */
function syncTodoToStock_() {
  var rec = { kind: 'ToDo取込', checkedAt: nowText_() };
  try {
    if (typeof Tasks === 'undefined') {
      return writeImportStatus_(STOCK.TODO_PROP, Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: 'Google Tasks連携（高度なGoogleサービス「Tasks」）が有効になっていません' }));
    }
    var todos = fetchTodoItems_();
    return withLock_(function () {
      var sheet = findStockSheet_();
      var rows = sheet ? stockRows_(sheet) : [];
      var byId = {};
      rows.forEach(function (r) { if (r.todoId) byId[r.todoId] = r; });
      var fresh = todos.filter(function (t) { return !byId[t.id] && t.state === 'open' && t.title; });
      var added = 0, noted = 0;
      if (fresh.length && !sheet) sheet = stockSheet_();
      var srcCol = SHEETS.STOCK.columns.map(function (c) { return c.key; }).indexOf('source') + 1;
      todos.forEach(function (t) {
        var ex = byId[t.id];
        if (!ex) return;
        var want = todoSourceLabel_(t.state);
        if (ex.source !== want) { sheet.getRange(ex.row, srcCol).setValue(want); noted++; }
      });
      var today = currentDate_();
      var seen = {};
      fresh.forEach(function (t) {
        if (seen[t.id]) return;
        seen[t.id] = true;
        appendObj_(sheet, SHEETS.STOCK, { content: t.title, writtenOn: today, source: STOCK_SOURCE_CALENDAR, hopeWeek: '', status: '未採用', todoId: t.id });
        added++;
      });
      return writeImportStatus_(STOCK.TODO_PROP, Object.assign(rec, { result: added || noted ? IMPORT_RESULT.DONE : IMPORT_RESULT.SKIP, added: added, noted: noted, todoCount: todos.length }));
    });
  } catch (e) {
    try { return writeImportStatus_(STOCK.TODO_PROP, Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: String((e && e.message) || e) })); } catch (e2) { return Object.assign(rec, { result: IMPORT_RESULT.FAIL, reason: String((e && e.message) || e) }); }
  }
}
