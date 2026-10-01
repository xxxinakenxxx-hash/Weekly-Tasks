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
| 資産 | 状態 | 確認内容 |
|---|---|---|
| 対象GAS | 未作成・要確認 | 個人アカウント（xxxinakenxxx@gmail.com）のDriveに該当Apps Scriptなし。scriptId 未確定。 |
| Google Sheets | 要確認 | Drive「週間タスクボード」フォルダに同名スプレッドシートあり（会社アカウント所有・1KB）。個人アカウントからは参照不可、ID・中身未確認。 |
| Google Drive | 確認済み（一部） | フォルダ「週間タスクボード」ID `1MrAlSf4NoaSTgQYQ1uNVQf-anSaO518Z`（所有者：会社アカウント）。正本4点・実装指示書は個人アカウントから参照不可のため、本リポジトリへ配置済み。 |
| Obsidian Vault | 要確認 | 正本で Vault＝「週間タスク」フォルダ、`通常業務.md`／`AI案件.md`、サブフォルダなしと確定。実在場所・同期方法は未確認。 |
| ローカル作業フォルダ | 要確認 | 正本・実装指示書に場所の記載なし。未確認。 |
| クロスレビュー確定事項md | 要確認 | Driveに「週間タスク・朝ブリーフ_v1.5_クロスレビュー確定事項.md」あり（会社アカウント所有・参照不可）。IS-00で固定すべきmdと同一か未確認。 |
