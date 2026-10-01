# Weekly-Tasks

「週間タスク・朝ブリーフ GAS Webアプリ」の開発リポジトリです。

## 資料と管理ファイルの場所
```
CLAUDE.md               Claude Code向けの恒久ルール
README.md               このファイル
tasks/TASK_CURRENT.md   工程管理（現在工程）
docs/official/          正本（統合企画書・案件概要書・機能仕様書・データ設計書 v1.7）
docs/implementation/    実装指示書（開発工程表＋テスト計画 v1.1、IS-00〜IS-06 v1.1）
```

## GASソース
```
src/                    GAS共通基盤（clasp の rootDir 予定。scriptId は未確定のため .clasp.json は未作成）
docs/DB_SCHEMA.md       Google Sheets 正データの項目定義（シート名・列順は未確定）
```

## 対象資産（IS-00 確認結果）
| 資産 | 状態 | 内容 |
|---|---|---|
| 対象GAS | 確認済み | scriptId `1PVnJColm5Rt3qGkSZnS0xT8mFWRAVZAMAPk3-enNalM0P_lA2zcRyZtS`（会社アカウント所有、「週間タスクボード」スプレッドシートに紐づく）。rootDir `src`。 |
| Webアプリ | 確認済み | 版1デプロイ `AKfycbzzfanSJ4PdfHUliYVv2XJHU-ozBiUQw7MYiMPUZl4qjxbMhLcPnC2nQxLfJeHHw4g`（access=MYSELF、executeAs=USER_DEPLOYING） |
| Google Sheets | 確認済み | 「週間タスクボード」 ID `1tk1ZaiM1JqPgw9ENAJ8xJN-zT8k4qKYmwroUvE4b1nE`。シート「タスク」「履歴」（docs/DB_SCHEMA.md）。 |
| Google Drive | 確認済み | フォルダ「週間タスクボード」 ID `1MrAlSf4NoaSTgQYQ1uNVQf-anSaO518Z`（会社アカウント所有）。正本4点・実装指示書もDrive上に存在。 |
| Obsidian Vault | 確認済み（Drive上） | Drive「週間タスクボード/週間タスク」 ID `1vAHdhUFYsQ86bnC_OPaWeczZU-_NhHnV`（`.obsidian` 設定フォルダあり）。現在の中身は `ようこそ.md` のみ。`通常業務.md`・`AI案件.md` は未作成。PC側のローカルパスは未確認。 |
| ローカル作業フォルダ | 未確認 | リポジトリ・正本・Driveに記載なし。 |
| クロスレビュー確定事項md | 特定済み・内容未読 | Drive「週間タスクボード/週間タスク・朝ブリーフ_v1.5_クロスレビュー確定事項.md」 ID `1FgPbEwDe7NeawKci7A71EyZUyDMSk5J_`（正本v1.7と同時刻 2026-09-11 13:25 JST に保存）。作業環境の権限では内容を読めない。 |
