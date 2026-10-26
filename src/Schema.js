/**
 * Google Sheets 正データ定義（docs/DB_SCHEMA.md と一致させる）
 */
// 状態6値（追加改修 2026-10-09：「保留」＝今週は何もせず来週以降に実施する。翌週の自動持越しの対象外）
var STATUS_VALUES = ['未着手', '進行中', '完了', '保留', '次週候補', '持越し'];
var KIND_VALUES = ['通常タスク', 'AI案件'];
var DAY_VALUES = ['月', '火', '水', '木', '金'];
// 追加実装 v1.1：1タスクに複数曜日。保存形式は月→金の固定順を「,」でつないだ文字列（例：月,火,水）。重複なし。空欄＝未配置
var DAY_SEPARATOR = ',';
// 「曜日」列の入力規則に使う、保存できる値の一覧（月〜金の空でない組み合わせ31通り。単一曜日の既存値も含む）
var DAY_COMBOS = (function () {
  var out = [];
  for (var m = 1; m < 32; m++) {
    out.push(DAY_VALUES.filter(function (d, i) { return m & (1 << i); }).join(DAY_SEPARATOR));
  }
  return out.sort(function (a, b) { return a.split(DAY_SEPARATOR).length - b.split(DAY_SEPARATOR).length || dayKey_(a) - dayKey_(b); });
  function dayKey_(s) { return s.split(DAY_SEPARATOR).reduce(function (n, d) { return n * 10 + DAY_VALUES.indexOf(d) + 1; }, 0); }
})();
// 朝ブリーフJSONの「AI案件現在地」の取得結果（追加実装 v1.1）。「確認済み」だけをAI案件現在地へ同期する
var AI_RESULT_VALUES = ['確認済み', '要確認', '不一致', '取得失敗', 'チャット未確認'];
var EXCEPTION_TYPES = ['要確認', '不一致', 'チャット未確認', '取得失敗'];
var HISTORY_OPS = ['作成', '修正', '状態変更', '削除'];
// ストック（追加実装 週間入口拡充）の状態と出どころ
var STOCK_STATUS_VALUES = ['未採用', '採用済み', '取り下げ'];
var STOCK_SOURCE_CALENDAR = 'カレンダー';
var STOCK_SOURCE_MANUAL = '手入力';

var SHEETS = {
  TASKS: {
    name: 'タスク',
    columns: [
      { key: 'taskId', header: 'タスクID', text: true },
      { key: 'targetWeek', header: '対象週', text: true, dateFormat: 'yyyy-MM-dd' },
      { key: 'title', header: 'タスク名／案件名' },
      { key: 'kind', header: '種別', values: KIND_VALUES },
      { key: 'day', header: '曜日', values: DAY_COMBOS },
      { key: 'status', header: '状態', values: STATUS_VALUES },
      { key: 'priority', header: '優先度' },
      { key: 'focus', header: '重点' },
      { key: 'result', header: '実施結果' },
      { key: 'memo', header: 'メモ' },
      { key: 'handover', header: '次回申し送り' },
      { key: 'exception', header: '例外情報' },
      { key: 'aiPosition', header: 'AI案件現在地' },
      { key: 'sourceTaskId', header: '持越し元タスクID', text: true },
      // IS-06：削除済みの印（TRUE＝削除済み、空欄＝通常）。行は消さずに残す
      { key: 'deleted', header: '削除済み' },
      // 追加改修④ 指示ルート：AI案件の「指示元 → 実装先」（自由記入。空欄＝未設定）
      { key: 'instructFrom', header: '指示元' },
      { key: 'implementTo', header: '実装先' },
      // 追加改修④ 継続処理：AI案件の識別キー（AI案件.md に記載された TASK_CURRENT.md の場所）。同じキーの前の週の行から指示ルートを引き継ぐ
      { key: 'caseKey', header: '案件キー' },
      // 追加改修③ 現在地の区別：「AI案件現在地」が日次巡回で「確認済み」として更新された日時（空欄＝日次で未確認。週次分析などの値）
      { key: 'aiConfirmedAt', header: '現在地確認日時', text: true, dateFormat: 'yyyy-MM-dd HH:mm' },
      // 日次AI現在地巡回の最新の取得事実（確認済み以外も記録する。「AI案件現在地」は確認済みのときだけ更新）
      { key: 'aiLatestAt', header: '最新取得日時', text: true, dateFormat: 'yyyy-MM-dd HH:mm' },
      { key: 'aiLatestResult', header: '最新取得結果' },
      { key: 'aiLatestPosition', header: '最新取得現在地' },
      // 追加実装 週間入口拡充：ユーザーが週間計画時に決める今週の作業内容（自由記入。AIは生成しない。空欄＝未記入）
      { key: 'weekPlan', header: '今週やること' }
    ]
  },
  HISTORY: {
    name: '履歴',
    columns: [
      { key: 'at', header: '日時', text: true, dateFormat: 'yyyy-MM-dd HH:mm:ss' },
      { key: 'taskId', header: 'タスクID', text: true },
      { key: 'op', header: '操作', values: HISTORY_OPS },
      { key: 'field', header: '項目' },
      { key: 'before', header: '変更前' },
      { key: 'after', header: '変更後' }
    ]
  },
  BRIEF: {
    name: '朝ブリーフ',
    columns: [
      { key: 'date', header: '日付', text: true, dateFormat: 'yyyy-MM-dd' },
      { key: 'savedAt', header: '保存日時', text: true, dateFormat: 'yyyy-MM-dd HH:mm:ss' },
      { key: 'oneLine', header: '今日の一言' },
      { key: 'flow', header: '今日の流れ' },
      { key: 'priorities', header: '今日優先すること' },
      { key: 'concerns', header: '気にかけておきたいこと' },
      { key: 'done', header: 'もう片づいていること' },
      { key: 'carryover', header: '未完了・持越し' }
    ]
  },
  // 2026-10-12：週間分析（ChatGPT Project）の「見立て」「コーション」を週ごとに残す（再読込で消えないように）。
  // 追記のみ（同じ週で保存し直した場合は新しい行を足し、表示は最新行）
  ANALYSIS: {
    name: '週間分析',
    columns: [
      { key: 'targetWeek', header: '対象週', text: true, dateFormat: 'yyyy-MM-dd' },
      { key: 'savedAt', header: '保存日時', text: true, dateFormat: 'yyyy-MM-dd HH:mm:ss' },
      { key: 'outlook', header: '見立て' },
      { key: 'cautions', header: 'コーション' }
    ]
  },
  // 追加実装 週間入口拡充：TODOタブのストック（カレンダーToDoと手入力）。週間分析が「未採用」を読む。
  // 「週間分析」シートと同様、TODOタブを初めて使うときに作る（setupSheets では作らない。既存シートの列は変えない）
  STOCK: {
    name: 'ストック',
    columns: [
      { key: 'content', header: '内容' },
      { key: 'writtenOn', header: '書いた日', text: true, dateFormat: 'yyyy-MM-dd' },
      // 出どころ：カレンダー／手入力。ToDo側で完了・削除された項目は「カレンダー（ToDo側で完了）」のように注記する（入力規則は付けない）
      { key: 'source', header: '出どころ' },
      { key: 'hopeWeek', header: '希望週', text: true, dateFormat: 'yyyy-MM-dd' },
      { key: 'status', header: '状態', values: STOCK_STATUS_VALUES },
      { key: 'todoId', header: 'ToDo側ID', text: true }
    ]
  }
};

// 正データとして管理するシート（setupSheets・checkSchema の対象）
var ALL_SHEETS = [SHEETS.TASKS, SHEETS.HISTORY, SHEETS.BRIEF];
// 「週間分析」シートは、週間画面で初めて見立て・コーションを保存するときに作る（setupSheets では作らない。既存シートは変更しない）

function headersOf_(def) {
  return def.columns.map(function (c) { return c.header; });
}
