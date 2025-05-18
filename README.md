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
node index.js events [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--format json|csv|text] [--summary daily]
```

- `--start YYYY-MM-DD` - 開始日を指定（例: 2025-05-01）
- `--end YYYY-MM-DD` - 終了日を指定（例: 2025-05-31）
- `--format FORMAT` - 出力形式を指定（json, csv, text のいずれか、デフォルトはjson）
- `--summary daily` - 日別の時間集計を表示

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

### 日別集計機能

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
- 日別の時間集計機能
- トークンはファイルに保存され、再利用可能

## 注意点

- このサンプルは学習目的のものです
- 実運用に使用する場合は、エラーハンドリングやセキュリティ対策を強化してください 