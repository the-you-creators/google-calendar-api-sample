# Google Calendar API サンプル

このプロジェクトはGoogle Calendar APIを使用してカレンダーの予定を取得するサンプルです。

## セットアップ

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. Google Calendar APIを有効化
3. OAuth同意画面を設定
4. OAuth 2.0クライアントIDを作成
5. 以下のコマンドで依存関係をインストール

```bash
npm install
```

6. 環境変数の設定
   - `.env`ファイルを作成し、以下の内容を設定してください
   ```
   CLIENT_ID=あなたのクライアントID
   CLIENT_SECRET=あなたのクライアントシークレット
   REDIRECT_URI=http://localhost:3000/oauth2callback
   CALENDAR_ID=あなたのカレンダーID（省略可能、デフォルトは primary）
   ```

## 使用方法

1. 認証URLの取得
   ```bash
   node index.js auth
   ```

2. 表示されたURLをブラウザで開き、認証を行う。認証後にリダイレクトURLからコードを取得

3. 取得したコードを使ってトークンを取得
   ```bash
   node index.js token <認証コード>
   ```

4. カレンダーのイベント取得
   ```bash
   node index.js events [オプション]
   ```

## コマンドラインオプション

イベント取得時に以下のオプションが利用可能です：

```bash
node index.js events [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--format json|csv|text] [--summary daily|weekly|monthly] [--include keyword1,keyword2,...] [--include-mode MODE] [--exclude keyword1,keyword2,...] [--exclude-mode MODE]
```

- `--start YYYY-MM-DD` - 開始日を指定（例: 2025-05-01）
- `--end YYYY-MM-DD` - 終了日を指定（例: 2025-05-31）
- `--format FORMAT` - 出力形式を指定（json, csv, text のいずれか、デフォルトはjson）
- `--summary TYPE` - 集計タイプを指定（daily, weekly, monthly のいずれか）
- `--include KEYWORDS` - 指定したキーワードを含むイベントのみを含める（カンマまたはスペース区切りで複数指定可能）
- `--include-mode MODE` - 含めるキーワードのマッチングモードを指定（下記参照）
- `--exclude KEYWORDS` - 指定したキーワードを含むイベントを除外（カンマまたはスペース区切りで複数指定可能）
- `--exclude-mode MODE` - 除外キーワードのマッチングモードを指定（下記参照）

### 出力形式

1. JSON形式（デフォルト）
   - 構造化されたJSON形式で出力されます
   - イベントの詳細情報（概要、説明、場所、開始・終了時間、所要時間など）が含まれます

2. CSV形式
   ```bash
   node index.js events --format csv
   ```
   - CSV形式でイベントが出力されます
   - 日付、開始時間、終了時間、所要時間、タイトル、場所、説明の列があります

3. テキスト形式
   ```bash
   node index.js events --format text
   ```
   - 読みやすい形式でイベントが表示されます
   - 各イベントの日付、時間、タイトル、所要時間が表示されます

### 集計機能

#### 日別集計

`--summary daily` オプションを使用すると、指定した期間の日別時間集計を表示できます：

```bash
node index.js events --start 2025-05-01 --end 2025-05-31 --summary daily --format text
```

- 日ごとの合計時間と予定数を確認できます
- 終日イベントは時間集計には含まれません
- 出力形式（json/csv/text）によって表示方法が変わります：
  - JSON: 構造化された日別集計データ（日付、総時間、イベント数など）
  - CSV: 日付、予定数、合計時間の一覧
  - TEXT: 読みやすい形式での日別集計表示

集計例（テキスト形式）：
```
2025年5月1日から2025年5月31日までの予定を取得します
日別集計（合計：120時間30分、85件）
2025年5月1日: 7時間30分（5件）
2025年5月2日: 6時間15分（4件）
...
```

#### 週別集計

`--summary weekly` オプションを使用すると、指定した期間の週別時間集計を表示できます：

```bash
node index.js events --start 2025-05-01 --end 2025-05-31 --summary weekly --format text
```

- 週ごとの合計時間と予定数を確認できます（日曜日から土曜日までを1週間として集計）
- 終日イベントは時間集計には含まれません
- 各出力形式（json/csv/text）に対応しています

集計例（テキスト形式）：
```
2025年5月1日から2025年5月31日までの予定を取得します
週別集計（合計：120時間30分、85件）
2025年5月4日 〜 2025年5月10日: 35時間45分（20件）
2025年5月11日 〜 2025年5月17日: 42時間15分（25件）
...
```

#### 月別集計

`--summary monthly` オプションを使用すると、指定した期間の月別時間集計を表示できます：

```bash
node index.js events --start 2025-01-01 --end 2025-12-31 --summary monthly --format text
```

- 月ごとの合計時間と予定数を確認できます
- 終日イベントは時間集計には含まれません
- 各出力形式（json/csv/text）に対応しています

集計例（テキスト形式）：
```
2025年1月1日から2025年12月31日までの予定を取得します
月別集計（合計：1250時間30分、850件）
2025年1月: 95時間30分（65件）
2025年2月: 105時間45分（72件）
...
```

### イベント絞り込み機能

#### 含めるキーワード

`--include` オプションを使用すると、特定のキーワードを含むイベントのみを抽出できます：

```bash
node index.js events --include ミーティング,会議
```

```bash
# スペース区切りでも指定可能
node index.js events --include "ミーティング 会議 打ち合わせ"
```

- カンマまたはスペース区切りで複数のキーワードを指定可能
- イベントのタイトル、説明、場所に指定したキーワードが含まれている場合のみ、そのイベントが結果に含まれます
- 抽出された件数は出力に表示されます（JSON/テキスト形式の場合）

#### 除外キーワード

`--exclude` オプションを使用すると、特定のキーワードを含むイベントを除外できます：

```bash
node index.js events --exclude 休憩,守護領域,不在
```

```bash
# スペース区切りでも指定可能
node index.js events --exclude "休憩 守護領域 不在"
```

- カンマまたはスペース区切りで複数のキーワードを指定可能
- イベントのタイトル、説明、場所に指定したキーワードが含まれている場合、そのイベントは結果から除外されます
- 除外された件数は出力に表示されます（JSON/テキスト形式の場合）

#### マッチングモード

`--include-mode`と`--exclude-mode`オプションを使用すると、キーワードのマッチング方法を変更できます：

```bash
# 含めるキーワードのマッチングモードを指定
node index.js events --include "社内 ミーティング" --include-mode all

# 除外キーワードのマッチングモードを指定
node index.js events --exclude "本 業対応,就寝" --exclude-mode any
```

以下のモードが利用可能です：

- `contains` - 部分一致（デフォルト）：キーワードがテキストの一部として含まれていれば一致
  ```bash
  # 「ミーティング」という文字が含まれるイベントのみを含める
  node index.js events --include ミーティング
  
  # 「休憩」という文字が含まれるイベントを除外
  node index.js events --exclude 休憩
  ```

- `exact` - 完全一致：テキストがキーワードと完全に一致する場合のみマッチ
  ```bash
  # タイトルが「ミーティング」だけのイベントのみを含める
  node index.js events --include ミーティング --include-mode exact
  
  # タイトルが「休憩」だけのイベントのみ除外
  node index.js events --exclude 休憩 --exclude-mode exact
  ```

- `word` - 単語一致：キーワードが単語として完全に一致する場合にマッチ
  ```bash
  # 「会議」が単語として含まれるイベントのみを含める
  node index.js events --include 会議 --include-mode word
  
  # 「休憩」が単語として含まれるイベントを除外
  node index.js events --exclude 休憩 --exclude-mode word
  ```

- `any` - いずれかの単語が一致：キーワード内のスペースで区切られた単語のいずれかが含まれていればマッチ
  ```bash
  # 「ミーティング」または「会議」のいずれかが含まれるイベントのみを含める
  node index.js events --include "ミーティング 会議" --include-mode any
  
  # 「本」または「業対応」のいずれかが含まれるイベントを除外
  node index.js events --exclude "本 業対応" --exclude-mode any
  ```

- `all` - すべての単語が一致：キーワード内のスペースで区切られた単語のすべてが含まれていればマッチ
  ```bash
  # 「社内」と「ミーティング」の両方が含まれるイベントのみを含める
  node index.js events --include "社内 ミーティング" --include-mode all
  
  # 「本」と「業対応」の両方が含まれるイベントを除外
  node index.js events --exclude "本 業対応" --exclude-mode all
  ```

- `regex` - 正規表現：キーワードを正規表現パターンとして扱い、マッチングを行う
  ```bash
  # 「会議」または「ミーティング」を含むイベントのみを含める
  node index.js events --include "会議|ミーティング" --include-mode regex
  
  # 「本業」または「対応」を含むイベントを除外
  node index.js events --exclude "本業|対応" --exclude-mode regex
  ```

除外・抽出の組み合わせ例：
```bash
# 「会議」を含むイベントのみを抽出し、「社内」を含むイベントを除外
node index.js events --include 会議 --exclude 社内 --format text

# 「顧客」と「ミーティング」の両方を含むイベントのみを抽出し、「休憩」を除外
node index.js events --include "顧客 ミーティング" --include-mode all --exclude 休憩 --format text
```

これを集計機能と組み合わせることも可能です：

```bash
node index.js events --summary monthly --include 会議 --exclude 休憩 --format text
```

## 所要時間の計算

各イベントの所要時間が自動的に計算され、出力に含まれます：
- 通常のイベント：時間と分（例：「1時間30分」）
- 終日イベント：「終日」または「〇日間」と表示

## ヘルプ

使用方法のヘルプを表示するには：

```bash
node index.js help
```

## 機能

- 特定期間のカレンダー予定を取得して表示
- JSON、CSV、テキスト形式での出力に対応
- 各イベントの所要時間の自動計算
- 日別・週別・月別の時間集計機能
- イベントの絞り込み機能
  - 特定キーワードを含むイベントのみを抽出する機能
  - 特定キーワードを含むイベントを除外する機能
  - 複数のマッチングモードをサポート（部分一致、完全一致、単語一致、複数単語など）
- トークンはファイルに保存され、再利用可能

## 注意点

- このサンプルは学習目的のものです
- 実運用に使用する場合は、エラーハンドリングやセキュリティ対策を強化してください 