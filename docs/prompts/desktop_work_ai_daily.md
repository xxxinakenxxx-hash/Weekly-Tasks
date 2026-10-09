# デスクトップ版Work 日次指示文（AI案件の現在地だけを巡回 → AI案件_日次現在地.md）

追加実装 v1.1。毎朝、朝ブリーフJSONを作る前に、デスクトップ版Workの定期実行として次を実行する（設定場所・方法・実行時刻は docs/WORK_SCHEDULE.md に実機で確認した内容を記録する）。
前提：デスクトップ版Workに `C:\Users\inamori240\Documents` へのアクセスを許可しておく。Google Driveは会社アカウントで接続する。
出力の書式は docs/AI_DAILY_FORMAT.md。週次の巡回（desktop_work_ai.md → AI案件.md）は従来どおり別に行う。

```
AI開発案件の「現在地だけ」を巡回し、Google Drive「週間タスクボード」フォルダ直下の「AI案件_日次現在地.md」へ保存してください（既存ファイルがあれば上書き。サブフォルダは作らない）。
「週間タスク」フォルダ（Obsidian Vault）には保存しない・読まないでください。

1. C:\Users\inamori240\Documents 配下から「TASK_CURRENT.md」という名前のファイルをすべて探し、見つかった各リポジトリを1案件として扱う。
   - 「C:\Users\inamori240\Documents\営業AIメモ_chat_file_copies_20260719」はチャットファイルの複製でリポジトリではないため、案件として扱わない。
   - 対象は、Documents 配下の4案件（machine-sales-system、営業AIメモ、機械販売事例アプリ、管理職AIメモ）と、次の1Aの1案件の合計5案件になる。これ以外の TASK_CURRENT.md が見つかった場合は、案件として扱ったうえで、報告で件数の違いを知らせる。
1A. 上の検索とは別に、次の「Claude Code案件」も1案件として扱う（ローカルの Documents 配下には無く、GitHub 上にある。ログイン不要で読める）。
   - 案件名：週間タスク・朝ブリーフ
   - TASK_CURRENT.md の場所（案件キーとしてそのまま書く）：https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md
   - 読む場所：TASK_CURRENT.md＝https://raw.githubusercontent.com/xxxinakenxxx-hash/Weekly-Tasks/HEAD/tasks/TASK_CURRENT.md、正本＝https://github.com/xxxinakenxxx-hash/Weekly-Tasks/tree/HEAD/docs/official、実装指示書＝https://github.com/xxxinakenxxx-hash/Weekly-Tasks/tree/HEAD/docs/implementation、開発履歴＝https://github.com/xxxinakenxxx-hash/Weekly-Tasks/commits/HEAD
   - Codexチャットは使っていない案件のため、Codexチャットは「対象外（Claude Code案件）」と書く。開発履歴（最新のコミット）を代わりの情報源として照らし合わせる。
   - 同じ案件を Documents 配下でも見つけた場合も1案件として扱い、上の場所を使う。
2. 案件ごとに次を読む。
   - その案件の TASK_CURRENT.md
   - Google Drive 上のその案件の正本・開発工程表・実装指示書・関連資料（1Aの案件は、GitHub 上の正本・実装指示書）
   - Codexチャット（タスク一覧・アーカイブ一覧・各スレッド本文 read_thread）
   - Claude Code案件（1A）は、Codexチャットの代わりに GitHub の開発履歴（最新のコミット）
3. 次の書式で書く。

# AI案件 日次現在地

取得日：（今日 yyyy-MM-dd）
取得日時：（yyyy-MM-dd HH:mm）
巡回フォルダ：C:\Users\inamori240\Documents

## 1. 案件名
- 取得日時：（yyyy-MM-dd HH:mm）
- 現在地：（確認できた現在工程・工程状態だけ。確認できない場合は空欄）
- 取得結果：確認済み／要確認／不一致／取得失敗／チャット未確認
- 内容：（確認済み以外の理由。不一致の場合は何と何が食い違うか）
- 確認元：
  - TASK_CURRENT.md：（ファイルの場所）
  - Drive：（読んだファイル名）
  - Codexチャット：（スレッド名。特定できない場合は「チャット未確認」。Claude Code案件は「対象外（Claude Code案件）」）
  - 開発履歴：（Claude Code案件だけ。読んだコミット履歴の場所と最新コミットの日時・内容）

ルール：
- 現在地だけを書く。新しいタスク候補・曜日案・優先度案・週全体の見立ては書かない。
- 確認できた事実だけを書き、推測で補わない。TASK_CURRENT.md にない内容を補わない。Drive資料だけで最新と判断しない。
- 情報源どうしが一致しない場合、どちらかを正としない。取得結果を「不一致」とし、何が違うかを書く。
- 読めなかった情報源がある場合は「取得失敗」、対応するCodexチャットを特定できない場合は「チャット未確認」、判断できない場合は「要確認」とする。Claude Code案件ではCodexチャットは対象外のため「チャット未確認」にしない（GitHub 上の場所を読めなければ「取得失敗」）。
- 一部の案件だけ取得できない場合も、取得できた案件は「確認済み」として書く。
- 巡回そのものに失敗した場合も、分かる範囲で「取得失敗」と書いて保存する。
- 保存後、ファイル名・保存先・案件数・確認済みの件数・確認済み以外の件数を報告する。
```
