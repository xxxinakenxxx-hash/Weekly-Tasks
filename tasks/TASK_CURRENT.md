# TASK_CURRENT

## 現在工程
IS-01 週間タスク画面実装

## 状態
進行中

## 現在の作業
IS-01 実装（IS-01_週間タスク画面実装_v1.1.docx 基準）：ローカル実装・テスト完了、GAS反映前（ユーザー確認待ち）

## IS-01 実施内容（ローカル）
- サーバー：src/Board.js 新規（getWeekBoard：対象週の正データ取得／commitWeekBoard：候補採用と既存変更を1回で保存。全件検証後に書込み、1件でも不正なら書かない）。src/Store.js を一括確定用に整理（作成・更新の検証と書込みを分離。動作は従来どおり）
- 画面：src/view_weekly.html・src/weekly.html（handoff.html を統合して削除）
  - 対象週の切替（前週・次週・再読込）、今週の要点、注意・コーション、今週の重点（件数、3〜5件の目安外は注記のみ）
  - 月〜金＋未配置の列に通常タスク/AI案件を混在表示、種別タグ、状態5値・優先度・重点・曜日・タスク名
  - 候補（ChatGPT Project分析結果）を週間ボードへ直接表示（仮テーブルなし）、候補の削除・修正、既存タスクの変更
  - 「確定して保存」1回の確認で保存し、正データを再読込して表示。変更は履歴シートへ記録
  - 確定済みタスクの削除は実装しない（正データを破壊しないため。状態で管理）
- テスト：board.test.js 11件、store.test.js 11件、is00test.test.js 3件、画面試験（PC/スマホ幅）64項目、すべて合格

## 完了工程
- IS-00 基盤・正データ構築：完了（2026-10-02 ユーザー確認）。記録は下記「IS-00 記録」

---

# IS-00 記録

## IS-00 完了条件の確認（実装指示書 §4）
| 完了条件 | 結果 | 根拠 |
|---|---|---|
| 受け渡し4経路が再現可能 | 充足 | PoC1〜4 すべて合格（下記） |
| Sheets実表とDB_SCHEMAが一致し、状態5値と履歴が保存/再読込できる | 充足 | runIs00SheetTest 合格（2026-10-01 16:44）、Drive上の実シート見出しも一致 |
| 2画面がPC/スマホで表示・遷移できる | 充足 | 版1デプロイでPC・実機スマホ確認OK（ユーザー確認、画面写真） |

## 完了済み
- 資料配置、管理ファイル作成（CLAUDE.md・README.md・TASK_CURRENT.md・.gitignore）
- 対象資産の確認とREADMEへの記録（GAS/Sheets/Drive/Obsidian Vault/ローカル作業フォルダ）
- ローカル作業フォルダ確定（2026-10-01 ユーザー決定）：`C:\Users\inamori240\Documents`。AI案件のローカルリポジトリ群の親フォルダ＝デスクトップ版Workにアクセス許可するフォルダ（同一）。Weekly-Tasks開発リポジトリの置き場所ではない
- 正本v1.7 4点とクロスレビュー確定事項md（Drive ID `1FgPbEwDe7NeawKci7A71EyZUyDMSk5J_`、反映先正本v1.7と明記）の確認
- GAS共通基盤（doGet、共通初期化、2画面枠、タブ移動、共通CSS/JS、エラー枠、本人利用範囲）
  - 本人利用範囲：manifest（executeAs=USER_DEPLOYING / access=MYSELF）と版1デプロイの実設定（Apps Script APIで確認）の両方で設定済み
- clasp接続（.clasp.json：scriptId `1PVnJColm5Rt3qGkSZnS0xT8mFWRAVZAMAPk3-enNalM0P_lA2zcRyZtS`、rootDir `src`）と clasp push（4回。各回 push前後の差分を確認）
- DB_SCHEMA 具体化（docs/DB_SCHEMA.md）、Sheets構築（「タスク」「履歴」、既存「シート1」は未変更）
- 実データ試験 runIs00SheetTest：状態5値・履歴の保存/再読込 合格、試験データ削除済み（1回目で日付自動変換の不具合を検出し修正）
- デプロイ：版1「IS-00 共通基盤」 `AKfycbzzfanSJ4PdfHUliYVv2XJHU-ozBiUQw7MYiMPUZl4qjxbMhLcPnC2nQxLfJeHHw4g`
- PC・実機スマホ確認（2026-10-01、ユーザー実施）：2画面表示・タブ移動・エラーなし・横はみ出しなし：OK
- PoC1 Work→Obsidian：合格。Vault直下に `通常業務.md`（ID `1EoWLJ_N502YW0P2hJroVNH9HXBUbhOSm`、6件）
- PoC2 ChatGPT Project→Obsidian読取：合格。回答（ID・6件・1件目名・期限・6件目名）が実ファイルと一致
- PoC3 ChatGPT Project→Sheets読取：合格。回答（ID・シート3つ・見出し・データ行0件）が実シートと一致
- PoC4 Project分析結果→週間画面：合格。貼り付け方式（2026-10-01 ユーザー決定、docs/HANDOFF_FORMAT.md）。/dev画面でエラーなし、対象週・見立て・コーション4件・タスク案6件を表示、保存なし
- ローカルテスト：画面18項目、PoC4画面28項目、正データ11件、試験関数3件、すべて合格

## 未確認事項
- Obsidian VaultのPC側ローカルパス
- データ行がある状態でのChatGPT Project→Sheets読取（IS-01で正データ保存後に確認）

## 補足
- 版1デプロイには分析結果の貼り付け表示は含まれない（/dev のみ）。公開版への反映はユーザー指示後。
- GAS上に試験関数 Is00Test.js（runIs00SheetTest）が残っている。

## 次に行う作業（IS-00時点）
IS-01 へ移行済み。
