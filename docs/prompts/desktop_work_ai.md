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
- 台帳の最新記録日：（今の現在地として採った記録の日付 yyyy-MM-dd と見出し）
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

現在地の決め方と判定（2026-10-11 ユーザー決定。すべての案件に同じ決まりを使う）：
- TASK_CURRENT.md の中で、日付（yyyy-MM-dd など）のある記録のうち、いちばん新しい記録を今の現在地とする。「現在地」「現在工程」などの見出しの欄でも、日付が古い記載や日付のない記載は、今の現在地として採らない。
- 台帳の中に、いちばん新しい記録と食い違う古い記載が残っている場合は、台帳を書き換えず、要確認欄に「台帳内に古い記載（見出し・要点）が残る」とだけ書く。古い記載は「不一致」の理由にしない。
- Drive資料・Codexチャット・開発履歴が、いちばん新しい記録より前の時点の内容なら、食い違っても「不一致」にしない（いちばん新しい記録を採る）。要確認欄に「（資料名）は（その時点）の内容」と書く。
- 「不一致」にするのは、いちばん新しい記録と同じ時点、またはそれより新しい資料が、別の内容を示している場合だけ。何と何が食い違うかを書く。
- いちばん新しい記録とDrive資料が一致している（またはDrive資料が古いだけの）場合、対応するCodexチャットを特定できなくても「情報源整合：一致」とし、要確認欄に「チャット未確認」と書く。
- 日付のある記録が無い場合は推測せず「要確認」、台帳を読めない場合は「取得失敗：TASK_CURRENT.md」と書く。
- 各案件に「台帳の最新記録日」（採った記録の日付と見出し）を必ず書く。

前回とのつながり（継続性）：
- Google Drive「週間タスクボード」フォルダ直下の「AI案件_日次現在地.md」（直近の日次巡回の結果）も読み、同じ案件（TASK_CURRENT.md の場所が同じもの）の「台帳の最新記録日」と比べる。今回の記録日のほうが古い場合は、台帳を読み直す。それでも古い場合は、今回の内容を書いたうえで、要確認欄に「直近の日次巡回（日付）の記録日（…）より古い」と書く。

ルール：
- Drive資料だけで最新と判断しない。TASK_CURRENT.md にない内容を推測で補わない。
- 案件に対応するCodexチャットを特定できない場合は推測で紐付けず「チャット未確認」と書く（Claude Code案件は「対象外（Claude Code案件）」）。
- GitHub 上の場所を読めなかった場合は推測で補わず「取得失敗：（場所）」と書く。
- 保存後、ファイル名・保存先・案件数・不一致の件数・チャット未確認の件数を報告する。
```
