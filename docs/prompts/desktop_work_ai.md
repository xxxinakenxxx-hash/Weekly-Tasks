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
   - 読む場所：下の判定基準 D の経路（1つ目で読めなくても、ほかの経路で読み直す）
   - Codexチャットは使っていない案件のため、Codexチャットは「対象外（Claude Code案件）」と書く。開発履歴（最新のコミット）を代わりの情報源として照らし合わせる。
   - 同じ案件を Documents 配下でも見つけた場合も1案件として扱い、上の場所を使う。
2. 案件ごとに次を読む。
   - 前回の結果（判定基準 B）：保存する前の既存の AI案件.md と AI案件_日次現在地.md
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
- 台帳の最新記録日：（現在地の根拠とした記載の日付 yyyy-MM-dd。冒頭の欄に日付が無い場合は「冒頭の欄（日付なし）」と書き、台帳で確認できる直近の記録の日付を添える）
- 現在地の根拠：（台帳のどの欄・記録を採ったか。冒頭の欄が未更新の場合はその旨）
- 前回の現在地：（前回の結果の現在地と、その結果の日付）
- 前回からの変化：変更なし／前進（根拠）／要確認（理由）
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

判定基準（週次・日次共通。2026-10-12 改訂。週次の AI案件.md と日次の AI案件_日次現在地.md は、必ずこの同じ基準で判定する）：
A. 現在地の決め方
  - TASK_CURRENT.md 冒頭（最初の見出し群）にある「現在工程」「現在地」「状態」などの欄を最優先で現在地とする。欄に日付が無くても採る。
  - 冒頭の欄の内容と、本文の直近の実装・試験・完了の記録を合わせて判断する。冒頭の欄より後の工程に進んだことを示す記録（実装・試験・完了）がある場合だけ、その記録を採り、根拠欄に「冒頭の欄が未更新」と書く。
  - 本文の日付付きの過去の記録（作業ログ）だけを根拠に、冒頭の欄より前の工程へ戻さない。
  - 冒頭に現在地の欄が無い場合だけ、本文の直近の記録から判断する。判断できなければ推測せず「要確認」。
B. 前回の現在地との照合
  - 保存する前に、前回の結果（週次＝上書きする前の AI案件.md、日次＝上書きする前の AI案件_日次現在地.md）と、もう一方の直近の結果（週次は AI案件_日次現在地.md、日次は AI案件.md）を読み、同じ案件キーの「現在地」と比べる。
  - 前回と同じなら「前回からの変化：変更なし」。前回より後の工程なら「前進」とし、根拠（台帳のどの記載か）を書く。
  - 前回より前の工程になる場合は、根拠が台帳の冒頭の欄で前の工程に戻したと明記されているときだけ採る（根拠を書く）。そうでなければ今回の判断を採らず、前回の現在地を書いたうえで「前回からの変化：要確認（前回より前の工程の記載あり：その記載）」とする。
C. 判定の区別（結果は次の4つのどれかに分ける）
  - 実際の矛盾：採った現在地と、同じ時点かそれより新しい資料（Drive の正本・工程表・指示書、Codexチャット、開発履歴）が、別の工程・別の方式を示している。→「不一致」。何と何が食い違うかを書く。
  - 古い記録・古い資料：台帳の過去の記録や、採った現在地より前の時点の資料と違うだけ。→ 不一致にしない。注記だけ書く（例：「Drive の工程表は Phase 1 時点」）。
  - チャット未確認：対応する Codexチャットを特定できない。台帳と Drive に実際の矛盾が無ければ「確認済み」（週次は「情報源整合：一致」）とし、注記に「チャット未確認」と書く。
  - 取得失敗：下の D のすべての経路で読めなかった情報源がある。→「取得失敗：情報源と経路ごとのエラー」。推測で補わない。
D. GitHub（Claude Code案件）の読み方
  - TASK_CURRENT.md は、次の順に読めるまで試す。1つ目で読めなくても取得失敗にしない。
    ① https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md
    ② https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md?plain=1
    ③ https://raw.githubusercontent.com/xxxinakenxxx-hash/Weekly-Tasks/HEAD/tasks/TASK_CURRENT.md
    ④ https://raw.githubusercontent.com/xxxinakenxxx-hash/Weekly-Tasks/refs/heads/claude/gallant-dijkstra-m5gen1/tasks/TASK_CURRENT.md
  - 開発履歴は ⑤ https://github.com/xxxinakenxxx-hash/Weekly-Tasks/commits/HEAD 、読めなければ ⑥ https://github.com/xxxinakenxxx-hash/Weekly-Tasks/commits/claude/gallant-dijkstra-m5gen1.atom 。正本・実装指示書は https://github.com/xxxinakenxxx-hash/Weekly-Tasks/tree/HEAD/docs/official と /docs/implementation。
  - 読めた経路を「確認元」に書く。すべて失敗した場合だけ、経路ごとのエラーを書いて「取得失敗」とする。
E. 対象と案件キー（変えない）
  - 対象は次の5案件。案件キー（TASK_CURRENT.md の場所）は一字も変えずに書く。
    ・機械売上管理システム：C:\Users\inamori240\Documents\machine-sales-system\tasks\TASK_CURRENT.md
    ・機械販売事例アプリ：C:\Users\inamori240\Documents\機械販売事例アプリ\tasks\TASK_CURRENT.md
    ・営業AIメモ：C:\Users\inamori240\Documents\営業AIメモ\tasks\TASK_CURRENT.md
    ・管理職AIメモ：C:\Users\inamori240\Documents\管理職AIメモ\tasks\TASK_CURRENT.md
    ・週間タスク・朝ブリーフ：https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md

ルール：
- Drive資料だけで最新と判断しない。TASK_CURRENT.md にない内容を推測で補わない。
- 案件に対応するCodexチャットを特定できない場合は推測で紐付けず、要確認欄に「チャット未確認」と書く（判定基準 C。実際の矛盾が無ければ情報源整合は「一致」。Claude Code案件は「対象外（Claude Code案件）」）。
- GitHub 上の場所は判定基準 D のすべての経路を試し、それでも読めなかった場合だけ、推測で補わず「取得失敗：（場所と経路ごとのエラー）」と書く。
- 保存後、ファイル名・保存先・案件数・不一致の件数・チャット未確認の件数を報告する。
```
