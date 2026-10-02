/**
 * Google Sheets 正データ定義（docs/DB_SCHEMA.md と一致させる）
 */
var STATUS_VALUES = ['未着手', '進行中', '完了', '次週候補', '持越し'];
var KIND_VALUES = ['通常タスク', 'AI案件'];
var DAY_VALUES = ['月', '火', '水', '木', '金'];
var EXCEPTION_TYPES = ['要確認', '不一致', 'チャット未確認', '取得失敗'];
var HISTORY_OPS = ['作成', '修正', '状態変更'];

var SHEETS = {
  TASKS: {
    name: 'タスク',
    columns: [
      { key: 'taskId', header: 'タスクID', text: true },
      { key: 'targetWeek', header: '対象週', text: true, dateFormat: 'yyyy-MM-dd' },
      { key: 'title', header: 'タスク名／案件名' },
      { key: 'kind', header: '種別', values: KIND_VALUES },
      { key: 'day', header: '曜日', values: DAY_VALUES },
      { key: 'status', header: '状態', values: STATUS_VALUES },
      { key: 'priority', header: '優先度' },
      { key: 'focus', header: '重点' },
      { key: 'result', header: '実施結果' },
      { key: 'memo', header: 'メモ' },
      { key: 'handover', header: '次回申し送り' },
      { key: 'exception', header: '例外情報' },
      { key: 'aiPosition', header: 'AI案件現在地' }
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
  }
};

// 正データとして管理するシート（setupSheets・checkSchema の対象）
var ALL_SHEETS = [SHEETS.TASKS, SHEETS.HISTORY, SHEETS.BRIEF];

function headersOf_(def) {
  return def.columns.map(function (c) { return c.header; });
}
