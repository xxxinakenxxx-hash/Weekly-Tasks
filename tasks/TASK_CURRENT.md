# TASK_CURRENT

## 現在工程
IS-00 基盤・正データ構築

## 状態
進行中

## 現在の作業
IS-00 受け渡しPoC（PoC1・PoC2合格・PoC3 ChatGPT Project→Sheets読取 のユーザー実施待ち）

## 完了済み
- 開発資料の配置
- Claude Code管理ファイルの作成
- 対象資産の確認とREADMEへの記録
- GAS共通基盤の実装（src/：doGet、共通初期化、2画面枠、タブ移動、共通CSS/JS、エラー枠）
- 共通基盤のローカル表示試験（PC/スマホ幅、18項目合格）
- DB_SCHEMA 具体化（docs/DB_SCHEMA.md：シート「タスク」13列、「履歴」6列）
- clasp 接続（.clasp.json：scriptId `1PVnJColm5Rt3qGkSZnS0xT8mFWRAVZAMAPk3-enNalM0P_lA2zcRyZtS`、rootDir `src`）
- 対象GASへ clasp push（src/ 12ファイル。GAS側を再読込し src/ と一致を確認）
- Sheets構築：既存「週間タスクボード」に「タスク」「履歴」シートを作成（既存「シート1」は変更なし）
- 実データ試験（runIs00SheetTest、会社アカウントで実行、2026-10-01 16:44）
  - DB_SCHEMA と実シート見出しの一致：合格（Driveから実シートを読み、タスク13列・履歴6列を確認）
  - 状態5値（未着手／進行中／完了／次週候補／持越し）の保存・再読込：合格
  - 履歴（作成・状態変更4件・修正1件）の保存・再読込：合格
  - 試験データの削除：タスク1行・履歴6行を削除し、試験前の状態（見出し行のみ）へ復元
- 不具合修正：Sheetsが日付文字列を日付型へ自動変換する件（1回目の試験で検出、読込時に文字列へ戻すよう修正）
- デプロイ作成（2026-10-01）：版1「IS-00 共通基盤」、デプロイID `AKfycbzzfanSJ4PdfHUliYVv2XJHU-ozBiUQw7MYiMPUZl4qjxbMhLcPnC2nQxLfJeHHw4g`
  - URL：https://script.google.com/a/macros/marubishi-group.co.jp/s/AKfycbzzfanSJ4PdfHUliYVv2XJHU-ozBiUQw7MYiMPUZl4qjxbMhLcPnC2nQxLfJeHHw4g/exec
  - 実デプロイ設定（Apps Script APIで確認）：access=MYSELF（本人のみ）、executeAs=USER_DEPLOYING
  - デプロイ前に GAS側コードが src/ と一致することを確認
- PoC前提確認（Drive上で確認）：Obsidian Vault＝Drive「週間タスクボード/週間タスク」、通常業務.md・AI案件.md は未作成、確定事項md を特定
- PoC1 Work→Obsidian：合格（2026-10-01、ユーザー確認）
  - Web版Workが Vault「週間タスク」直下に `通常業務.md` を保存（ID `1EoWLJ_N502YW0P2hJroVNH9HXBUbhOSm`、5438バイト、2026-10-01 17:15 JST 作成）
  - Markdownとして再読込成功、6件保存、ChatGPT Project側からもDrive上のファイルを読取できた（ユーザー確認）
  - 作業環境からもDrive経由で内容を読み、6件・見出し構成を確認
- PoC2 ChatGPT Project→Obsidian読取：合格（2026-10-01）
  - ChatGPT Projectの回答（ファイル名、ファイルID、件数6、1件目「勤怠の確認・月次提出」、期限「2026-10-01（木）17:30」、6件目「機械先行管理アプリへの移行」）が、作業環境でDriveから読んだ実ファイルの内容とすべて一致
- PCブラウザ確認（2026-10-01、ユーザー実施・画面写真2枚で確認）：週間タスク画面表示、朝ブリーフ画面表示、タブ移動、エラー表示なし：OK
- 実機スマホ確認（2026-10-01 16:50〜16:51、ユーザー実施・画面写真2枚で確認）：2画面表示、タブ移動（両タブの選択状態を確認）、横はみ出しなし、タブは横幅いっぱいで押せる：OK

## 未確認事項
- 受け渡しPoC 残り2経路（ChatGPT Project→Sheets読取、Project分析結果→週間画面）
- ローカル作業フォルダの場所、Obsidian VaultのPC側ローカルパス
- クロスレビュー確定事項md の内容（ファイルは特定済み。作業環境の権限では未読）
- PoC4（Project分析結果→週間画面）の受け渡し方式（正本で未確定）

## 次に行う作業
IS-00の残作業（受け渡しPoC 4経路、場所の確認、IS-00完了報告）。ユーザー指示後に着手する。IS-01へは進まない。
