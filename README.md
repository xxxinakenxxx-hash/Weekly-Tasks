# Weekly-Tasks

「週間タスク・朝ブリーフ GAS Webアプリ」の開発リポジトリです。

## 資料と管理ファイルの場所
```
CLAUDE.md               Claude Code向けの恒久ルール
README.md               このファイル
tasks/TASK_CURRENT.md   工程管理（現在工程）
docs/official/          正本（統合企画書・案件概要書・機能仕様書・データ設計書 v1.7）
docs/implementation/    実装指示書（開発工程表＋テスト計画 v1.1、IS-00〜IS-06 v1.1、追加実装指示書 v1.1）
docs/DB_SCHEMA.md       Google Sheets 正データ定義（シート「タスク」15列＝IS-04で「持越し元タスクID」、IS-06で「削除済み」を追加、「履歴」6列、「朝ブリーフ」8列）
docs/HANDOFF_FORMAT.md  ChatGPT Project分析結果の受け渡し形式（貼り付け方式・JSON）
docs/OBSIDIAN_FORMAT.md 通常業務.md・AI案件.md の書式
docs/BRIEF_FORMAT.md    朝ブリーフの受け渡し形式（朝情報.md＋AI案件_日次現在地.md → Project → 画面で保存。AI案件現在地はtaskIdで同期）
docs/AI_DAILY_FORMAT.md AI案件_日次現在地.md の書式（Desktop版Workの日次AI現在地巡回、追加実装 v1.1）
docs/WORK_SCHEDULE.md   Workの自動実行設定（設定場所・方法・実行時刻・出力先。実機で確認した内容だけを記録）
docs/prompts/           週次・毎朝の標準指示文（Web版Work・デスクトップ版Work・ChatGPT Project）
```

## GASソースとテスト
```
.clasp.json             scriptId と rootDir=src
src/                    GASソース（clasp push の対象）
  Code.js               doGet・共通初期化・エラー画面
  Config.js / Schema.js / Store.js   正データ設定・定義・読み書き（履歴付き）
  Board.js              週間タスク画面のサーバー処理（getWeekBoard・commitWeekBoard・getCarryCandidates・getTaskHistory）
  Brief.js              朝ブリーフのサーバー処理（getMorningBrief・saveMorningBrief）
  Is00Test.js           IS-00 実データ試験（runIs00SheetTest）
  index.html ほか       2画面枠・タブ移動・共通CSS/JS・エラー枠
  view_weekly.html / weekly.html   週間タスク画面（表示・編集・候補の採用/削除・1回確定・再読込）
  view_brief.html / brief.html     朝ブリーフ画面（読込・保存・日付切替・表示、今週のタスクの日次更新）
tests/                  ローカルテスト（node tests/store.test.js、is00test.test.js、board.test.js、brief.test.js、carry.test.js＝日次更新・持越し、exception.test.js＝例外・不一致、delete.test.js＝保存済みタスクの削除、multiday_ai.test.js＝複数曜日・日次AI現在地の同期）
```

## 対象資産（IS-00 確認結果）
| 資産 | 状態 | 内容 |
|---|---|---|
| 対象GAS | 確認済み | scriptId `1PVnJColm5Rt3qGkSZnS0xT8mFWRAVZAMAPk3-enNalM0P_lA2zcRyZtS`（会社アカウント所有、「週間タスクボード」スプレッドシートに紐づく）。rootDir `src`。 |
| Webアプリ | 確認済み | 公開：版1 `AKfycbzzfanSJ4PdfHUliYVv2XJHU-ozBiUQw7MYiMPUZl4qjxbMhLcPnC2nQxLfJeHHw4g`（access=MYSELF、executeAs=USER_DEPLOYING）。開発用：HEAD `AKfycbxsmssqLMIBVOdw47eLBEYuRE4MAkYjdh2_UFJyig`（/dev）。版1には分析結果の貼り付け表示は含まれない。 |
| Google Sheets | 確認済み | 「週間タスクボード」 ID `1tk1ZaiM1JqPgw9ENAJ8xJN-zT8k4qKYmwroUvE4b1nE`。シート「タスク」「履歴」（データ行0件）。既存「シート1」は未変更。 |
| Google Drive | 確認済み | フォルダ「週間タスクボード」 ID `1MrAlSf4NoaSTgQYQ1uNVQf-anSaO518Z`（会社アカウント所有）。正本4点・実装指示書もDrive上に存在。 |
| Obsidian Vault | 確認済み | Drive「週間タスクボード/週間タスク」 ID `1vAHdhUFYsQ86bnC_OPaWeczZU-_NhHnV`（`.obsidian` あり）。`通常業務.md` 作成済み（PoC1）。`AI案件.md` は未作成（IS-02でデスクトップ版Workが作成）。PC側のローカルパスは未確認。 |
| ローカル作業フォルダ | 確定（2026-10-01 ユーザー決定） | Windows PC `C:\Users\inamori240\Documents`。AI案件のローカルリポジトリ群をまとめている親フォルダで、デスクトップ版Workにアクセス許可するフォルダとして使用する（同一の場所）。Weekly-Tasks開発リポジトリの置き場所ではない。AI案件巡回では、配下の各AI案件リポジトリ内の `TASK_CURRENT.md` を参照する。 |
| クロスレビュー確定事項md | 確認済み | Drive「週間タスクボード/週間タスク・朝ブリーフ_v1.5_クロスレビュー確定事項.md」 ID `1FgPbEwDe7NeawKci7A71EyZUyDMSk5J_`。本文に「反映先正本：v1.7（2026-09-11修正反映）」と明記。内容は正本v1.7と一致し、本リポジトリの実装（候補の仮保存なし・状態1項目）と矛盾なし。 |

## 受け渡し方式（IS-00 で固定）
| 経路 | 方式 | PoC |
|---|---|---|
| Work → Obsidian | Web版WorkがDrive上のVault直下へMarkdownを保存 | 合格 |
| ChatGPT Project → Obsidian読取 | ProjectがDrive上のVault内ファイルを直接読む | 合格 |
| ChatGPT Project → Sheets読取 | ProjectがDrive上の「週間タスクボード」を直接読む | 合格 |
| Project分析結果 → 週間画面 | 貼り付け方式（docs/HANDOFF_FORMAT.md）。保存なし | 合格 |
