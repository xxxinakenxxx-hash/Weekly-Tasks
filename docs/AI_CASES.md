# ローカル以外のAI案件一覧（Claude Code案件）

追加改修③（2026-10-09、Claude Code実装案件の取得漏れ）。

## 位置づけ
- Desktop版Workの週次AI巡回・日次AI現在地巡回は、`C:\Users\inamori240\Documents` 配下の `TASK_CURRENT.md` を1案件として探す（Codex案件。従来どおり）。
- Claude Code（Web版）で開発している案件は、作業台帳（TASK_CURRENT.md）・正本・実装指示書・開発履歴が GitHub 上にあり、ローカルの Documents 配下に無い。そのため、Documents の検索では見つからない。
- この一覧の案件は、Documents の検索に加えて、下記の場所から読む。巡回指示文（docs/prompts/desktop_work_ai.md、desktop_work_ai_daily.md）にも同じ内容を書く。
- 「案件キー」は下記の固定値を使う（週間タスクの「案件キー」列、AI案件.md・AI案件_日次現在地.md の「TASK_CURRENT.md：」欄、朝ブリーフJSONの「案件キー」と同じ値）。ブランチ名に依存しない `HEAD`（リポジトリの既定ブランチ）を使う。

## 一覧

### 週間タスク・朝ブリーフ
- 開発AI：Claude Code（Web版）。Codexチャットは使っていない
- 案件キー：`https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md`
- TASK_CURRENT.md（読む場所）：https://raw.githubusercontent.com/xxxinakenxxx-hash/Weekly-Tasks/HEAD/tasks/TASK_CURRENT.md
- 正本：https://github.com/xxxinakenxxx-hash/Weekly-Tasks/tree/HEAD/docs/official （統合企画書・案件概要書・機能仕様書・データ設計書 v1.7、docx）
- 実装指示書：https://github.com/xxxinakenxxx-hash/Weekly-Tasks/tree/HEAD/docs/implementation （開発工程表＋テスト計画、IS-00〜IS-06、追加実装指示書・追加改修指示書）
- 開発履歴：https://github.com/xxxinakenxxx-hash/Weekly-Tasks/commits/HEAD （コミット履歴）、課題：https://github.com/xxxinakenxxx-hash/Weekly-Tasks/issues
- リポジトリは公開設定（ログイン不要で読める。2026-10-09 確認）

## 取得のルール
- 現在地は TASK_CURRENT.md の記載を正とし、正本・実装指示書・開発履歴（最新のコミット）と照らし合わせる。食い違いは「不一致」とし、何が違うかを書く。
- 読めなかった場所がある場合は「取得失敗：（場所）」とし、推測で補わない。
- Codexチャットは対象外（「Codexチャット：対象外（Claude Code案件）」と書く。「チャット未確認」にはしない）。
- 同じ案件を Documents 配下でも見つけた場合（ローカルに複製がある場合）も1案件として扱い、案件キーは上記の固定値を使う。
