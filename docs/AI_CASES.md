# AI案件の見つけ方（案件の自動発見）

2026-10-15 改訂（ユーザー指示）。それまでの「ローカル4案件＋GitHub 1案件（週間タスク・朝ブリーフ）を指示文と本書に個別登録する方式」をやめ、Desktop版Workが巡回のたびに自動で案件を見つける方式にした。新しい案件を本書や指示文へ登録する必要はない。

## 根拠（実機で確認した探索方式）
- ローカル（Desktop版Work）：`C:\Users\inamori240\Documents` 直下のフォルダ（16件）を一覧にし、各フォルダの `tasks\TASK_CURRENT.md` の有無だけを確認 → 4件発見、エラーなし（案件名・個別パスの事前指定なし）。
- GitHub（Desktop版Work）：GitHub連携で所有者 `xxxinakenxxx-hash` のアクセスできるリポジトリ一覧を取得し、各デフォルトブランチの `tasks/TASK_CURRENT.md` を確認する方式で、リポジトリ名の事前指定なしに発見できた。
- GitHub の現在の実データ（2026-10-16、Desktop版Work の実機確認と Claude Code の読み取りのみの確認で一致。下の「実機で確認済み」）：リポジトリ16件のうち `tasks/TASK_CURRENT.md` があるのは5件。
- 使わない方法（実機で問題があったため）：Documents 全体を `TASK_CURRENT.md` の名前で再帰検索する方法（入れ子のリポジトリや複製まで拾い、権限エラーも出た）。リポジトリを指定しない GitHub 全体のコード検索（所有者以外の公開リポジトリが混ざった）。

## 探索の手順（巡回指示文 desktop_work_ai.md・desktop_work_ai_daily.md の手順1と同じ）
1. ローカル：Documents 直下の各フォルダの `tasks\TASK_CURRENT.md` があれば案件候補。再帰検索しない。
2. GitHub：所有者 `xxxinakenxxx-hash` のリポジトリ一覧 → 各デフォルトブランチの `tasks/TASK_CURRENT.md` があれば案件候補。404 は案件ではないとして次へ進む。
3. 同じ案件の判定：ローカルのフォルダの `.git\config` の `[remote "origin"]` の url を owner/repo の形にして（https・ssh、末尾 `.git`、大文字小文字の違いは同じとみなす）、手順2の案件候補の `xxxinakenxxx-hash/（リポジトリ名）` と一致する場合だけ同じ案件とする。origin が無い・読めない・一致しない場合は同じ案件とみなさない。名前の似ている案件を推測で同じにしない。GitHub 側に `tasks/TASK_CURRENT.md` が無い（404）場合は、ローカルだけの案件として続ける。
4. 同じ案件のときに読む TASK_CURRENT.md（ユーザー決定：更新日時が新しい方）：ローカルはファイルの最終更新日時、GitHub はデフォルトブランチで `tasks/TASK_CURRENT.md` を最後に変更したコミットの日時（`commits?path=tasks/TASK_CURRENT.md&sha=（デフォルトブランチ）&per_page=1` に当たる取得。ファイル内の日付は使わない）。日本時間にそろえて比べ、新しい方を読む。どちらかを取れない・同じ時刻のときは読まず「要確認」。
5. 案件キー（案件の識別子。今回どちらを読んだかとは別。読む方が変わっても変えない）：
   - 既存の案件を確かめる場所（2系統）：前回の結果（AI案件.md と AI案件_日次現在地.md）と「タスク」シートの種別 AI案件の行（「タスク名／案件名」列と「案件キー」列。読むだけ）。
   - 先に「案件があるか」を決め、次に「その案件に有効なキーがあるか」を決める（2026-10-16 ユーザー決定。Desktop版Work 実機の Aegis Mesh で判明）。キーが見つからないことだけで「案件なし」としない。「案件の行はあるがキー欄が空欄」は「案件なし」ではない。
     - 同じ案件と確定する強い根拠は2つだけ（2026-10-16 ユーザー決定）：有効なキー（アプリと同じく `TASK_CURRENT.md` で終わる値）が今回の「ローカルの場所」「GitHub の場所」と同じ／リポジトリ（owner/repo）が同じ（前回の「リポジトリ：」、GitHub の形のキー、キー欄の GitHub URL（`.git` 付きなど）。ローカルは origin を正規化した owner/repo）。
     - 案件名だけでは同じ案件と確定しない（大文字小文字・空白・「-」「_」・記号の違いをなくした比較、部分一致、似ている文字列でも）。名前が同じ・似ている（例：Aegis Mesh と Aegis-Mesh）案件・行があり、強い根拠で同じとも別とも決められなければ「既存案件の可能性あり」として、新しいキーを決めない（誤った新規採番を止めるためだけに使う）。リポジトリが違うと分かる行は、名前が同じでも別の案件。
     - 強い根拠で同じと確定した案件・行のキーが空欄・「なし」・不正（例：`https://github.com/owner/repo.git`）なら、有効なキーではない。
   - ① 有効なキーが1つ：必ずそのまま使う。② 有効なキーが2つ以上：まとめず、新しいキーも決めず「要確認」。
   - ③ 有効なキーが無く、強い根拠で同じ案件はある（キー空欄・不正）、または「既存案件の可能性あり」の行がある：新しいキーを決めず「案件キー確認不能」（可能性ありの行は同じ案件とも確定せず、そのキーも引き継がない）。今回見つけたローカルの場所や GitHub の URL でキーを補ったり作り直したりしない。不正なキーも直さない。
   - ④ 新しいキーを決めてよいのは、前回の結果（AI案件.md と AI案件_日次現在地.md の両方を通常の結果として）と「タスク」シートの両方を正常に確認でき、両方ともこの案件そのものが無い（強い根拠で同じ案件も、既存案件の可能性ありの行も無い＝新しい案件と確定できる）場合だけ（2026-10-16 ユーザー決定）。ローカルだけ＝`C:\Users\inamori240\Documents\（フォルダ名）\tasks\TASK_CURRENT.md`、GitHub だけ・最初から両方＝`https://github.com/xxxinakenxxx-hash/（リポジトリ名）/blob/HEAD/tasks/TASK_CURRENT.md`。
   - ⑤ 案件が見つからず、前回の結果とシートのどちらか一方でも正常に確認できなかった場合は、既存か新規か確定できないため新しいキーを決めない（確認できなかった側に既存の案件があるかもしれず、二重登録を防ぐ）。「案件キー確認不能」。
   - 「案件キー確認不能」（③・⑤）は、「TASK_CURRENT.md：」は「なし」、取得結果（週次は情報源整合）は「要確認」、注記の先頭に「案件キー確認不能：（理由）」。週間分析ではタスク案に出さずコーションに書き、朝ブリーフでは案件キー・taskId を空にして同期しない。アプリ・シートの列・既存データは変えない（取得結果の値は既存の「要確認」を使う。キーの空欄・不正はユーザーが直す）。
   - これで「GitHub だけだった案件を後でローカルにも置く」「ローカルだけだった案件を後で GitHub にも置く」「読む方が切り替わる」のどの場合も、案件キーは既存の値のまま変わらない（シートの手直しは要らない）。
   - 記録：「TASK_CURRENT.md：」＝案件キー、「リポジトリ：」＝owner/repo、「今回読んだTASK_CURRENT.md：」＝今回読んだ場所、「更新日時：」＝比べた2つの日時、「読めた経路：」＝取得経路・エラー（巡回指示文の書式）。

## 案件キーの決まり（2026-10-14 からの制約を維持）
- 「TASK_CURRENT.md：」欄・朝ブリーフJSON・週間分析JSONの「案件キー」には場所だけを書き、取得経路やエラーは別の行（読めた経路）・「内容」に書く。
- アプリ（src/Brief.js・src/brief.html・src/weekly.html）は、案件キーの末尾が `TASK_CURRENT.md` でない値（説明が付いた値など）を受け付けない。突き合わせは前後の空白・「/」「\」・大文字小文字の違いを同じとみなす（caseKeyNorm_）。
- 既存の案件キー（例：Weekly-Tasks は `https://github.com/xxxinakenxxx-hash/Weekly-Tasks/blob/HEAD/tasks/TASK_CURRENT.md`、ローカルの各案件は Documents 直下のパス）は、上の決まりで同じ値になる。

## GitHub の案件の読み方
- TASK_CURRENT.md・開発履歴は GitHub連携で読む。読めなければ blob（HEAD）・?plain=1・raw（HEAD）の順に試す。読めた経路は「読めた経路：」の行に書く。
- Codexチャットは、Claude Code で開発している案件（TASK_CURRENT.md などにそう書かれている）は「対象外（Claude Code案件）」。それ以外は特定できなければ「チャット未確認」。

## 実機で確認済み
- Desktop版Work（2026-10-15）：ローカルの動的探索（4件）。GitHub の動的探索（所有者のリポジトリ一覧から各デフォルトブランチを確認する方式）。remote origin の取得は一部の案件で可能：営業AIメモ＝`xxxinakenxxx-hash/external-voice-poc`（GitHub にも TASK_CURRENT.md あり＝同じ案件）、管理職AIメモ＝`xxxinakenxxx-hash/management-AImemo`（GitHub 側は TASK_CURRENT.md なし）、machine-sales-system＝origin を取得できず、機械販売事例アプリ＝`.git\config` はあるが origin 未設定。GitHub の `tasks/TASK_CURRENT.md` を最後に変更したコミット日時の取得。external-voice-poc はローカル 2026-10-15 17:13:24.5416819 JST、GitHub 2026-10-15 15:37:45 JST で比較でき、ローカルが新しい。
- GitHub の現在の実データ（2026-10-16、Claude Code が読み取りのみで確認。リポジトリ一覧＝セッションのリポジトリ一覧機能、デフォルトブランチ＝git ls-remote --symref、ファイル＝非公開はGitHub連携のファイル取得、公開は raw.githubusercontent.com の HEAD）：所有者 `xxxinakenxxx-hash` のリポジトリ15件。`tasks/TASK_CURRENT.md` あり＝4件：AI-memo（非公開、main、先頭行「# TASK_CURRENT」）、New-Sales-Cases（main、「# TASK_CURRENT」）、Weekly-Tasks（claude/gallant-dijkstra-m5gen1、「# TASK_CURRENT」）、external-voice-poc（main、「# TASK_CURRENT.md」）。なし＝11件：Aegis-Mesh・trend-report-site・shopping-list・management-AImemo・dialysis-weight-app・shpping-list・sogoten2026・salesAI（公開、raw で 404）、promptory・recipe-vault・ComprehensiveFortuneTelling（非公開、GitHub連携で「ファイルなし」）。11件ともデフォルトブランチは main。この確認の後、同じ日に次の変化があった（下の Desktop版Work の実機確認と、Claude Code の再確認）。
- Desktop版Work（2026-10-16、ユーザーの実機確認）：リポジトリ16件、`tasks/TASK_CURRENT.md` あり＝5件（external-voice-poc・AI-memo・Weekly-Tasks・New-Sales-Cases・Aegis-Mesh）。Aegis Mesh は前回の巡回結果に記載なし、「タスク」シートに「Aegis Mesh」の案件行あり・案件キー欄は空欄。自動で採番せず「案件キー確認不能」が正しい判定で、「案件なし」と「案件あり・キーなし」を分ける必要があると分かった。名前（Aegis Mesh と Aegis-Mesh）だけでは同じ案件と確定せず、既存案件の可能性ありとして扱う（2026-10-16 ユーザー決定）。
- Claude Code の再確認（2026-10-16、読み取りのみ）：リポジトリ一覧は16件（増えたのは AI-Development-Law。main、`tasks/TASK_CURRENT.md` は raw で 404）。Aegis-Mesh は main に `tasks/TASK_CURRENT.md` あり（raw で 200、先頭行「# TASK_CURRENT」、「更新日：2026-10-16」。リポジトリの最終 push は 2026-10-16T01:36:24Z）。

## 未確認（実機で確かめていないこと）
- 上の手順を本番の巡回指示文として Desktop版Workで実行した結果（指示文・ルール・テストはローカルで実装・テスト済み）。
- 前回の結果を読めなかったときに、Desktop版Workが「タスク」シートの案件キー列を読めるか。
