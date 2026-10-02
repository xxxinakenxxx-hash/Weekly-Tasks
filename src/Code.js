/**
 * 週間タスク・朝ブリーフ GAS Webアプリ 共通基盤（IS-00）
 * 本人利用範囲：appsscript.json の webapp.access = MYSELF（デプロイした本人のみ利用可）
 */

var APP_TITLE = '週間タスク・朝ブリーフ';

// 画面定義（週間タスク／朝ブリーフの2画面）
var VIEWS = {
  weekly: { file: 'view_weekly', label: '週間タスク' },
  brief: { file: 'view_brief', label: '朝ブリーフ' }
};
var DEFAULT_VIEW = 'weekly';

function doGet(e) {
  try {
    var ctx = initApp_(e);
    var tpl = HtmlService.createTemplateFromFile('index');
    tpl.ctx = ctx;
    return tpl.evaluate()
      .setTitle(APP_TITLE)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    return renderError_(err);
  }
}

// 共通初期化：表示画面の決定と画面へ渡す共通情報
function initApp_(e) {
  var params = (e && e.parameter) || {};
  var view = VIEWS[params.view] ? params.view : DEFAULT_VIEW;
  return {
    appTitle: APP_TITLE,
    initialView: view,
    views: Object.keys(VIEWS).map(function (key) {
      return { key: key, label: VIEWS[key].label };
    }),
    appUrl: ScriptApp.getService().getUrl(),
    currentWeek: currentWeek_(),
    today: currentDate_(),
    statusValues: STATUS_VALUES,
    kindValues: KIND_VALUES,
    dayValues: DAY_VALUES
  };
}

// HTMLテンプレートから部品ファイルを読み込む
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// doGet失敗時のエラー表示
function renderError_(err) {
  var tpl = HtmlService.createTemplateFromFile('error');
  tpl.message = String((err && err.message) || err);
  console.error(err);
  return tpl.evaluate()
    .setTitle(APP_TITLE + '（エラー）')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
