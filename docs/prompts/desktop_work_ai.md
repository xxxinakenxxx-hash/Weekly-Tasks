# デスクトップ版Work 週次指示文（AI案件巡回 → AI案件.md）

週間タスクを作る直前に、デスクトップ版Workへ次をそのまま送る。
前提：デスクトップ版Workに `C:\Users\inamori240\Documents` へのアクセスを許可しておく。Google Driveは会社アカウントで接続する。
追加実装 v1.1：この週次巡回はデスクトップ版Workの定期実行として設定する（設定場所・方法・実行時刻は docs/WORK_SCHEDULE.md に実機で確認した内容を記録する）。毎朝の現在地だけの巡回は別の指示文（desktop_work_ai_daily.md）で行う。

```
AI開発案件の現在地を巡回し、Google Drive「週間タスクボード」フォルダ内「週間タスク」フォルダ直下の「AI案件.md」へ保存してください（既存ファイルがあれば上書き。サブフォルダは作らない）。

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
3. 案件ごとに次の書式で書く。

# AI案件

対象週：（今週の月曜 yyyy-MM-dd）（月）〜（日曜 yyyy-MM-dd）（日）
確認日：（今日 yyyy-MM-dd）
巡回フォルダ：C:\Users\inamori240\Documents

## 1. 案件名
- 現在工程：
- 工程状態：途中／完了
- 完了内容：
- 残事項：
- 次回開始位置：現工程の続き／次工程
- 次にやる具体作業：
- 現在の手番：
- 情報源整合：一致／不一致／要確認
- 要確認：（判断不能な例外のみ。なければ「なし」）
- 参照した情報源：
  - TASK_CURRENT.md：（ファイルの場所）
  - Drive：（読んだファイル名）
  - Codexチャット：（スレッド名。特定できない場合は「チャット未確認」。Claude Code案件は「対象外（Claude Code案件）」）
  - 開発履歴：（Claude Code案件だけ。読んだコミット履歴の場所と最新コミットの日時・内容）
- 不一致の内容：（情報源整合が「不一致」の場合だけ）

ルール：
- 情報源どうしが一致しない場合、どちらかを正としない。「情報源整合：不一致」とし、何が違うかを書く。
- Drive資料だけで最新と判断しない。TASK_CURRENT.md にない内容を推測で補わない。
- 案件に対応するCodexチャットを特定できない場合は推測で紐付けず「チャット未確認」と書く（Claude Code案件は「対象外（Claude Code案件）」）。
- GitHub 上の場所を読めなかった場合は推測で補わず「取得失敗：（場所）」と書く。
- 保存後、ファイル名・保存先・案件数・不一致の件数・チャット未確認の件数を報告する。
```
