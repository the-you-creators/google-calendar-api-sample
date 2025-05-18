const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

// OAuth2クライアントの設定
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// 認証URLの生成
function getAuthUrl() {
  const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  
  console.log('認証URLを開いてください:', url);
}

// トークンの取得
async function getTokenFromCode(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // トークンを保存
    fs.writeFileSync('tokens.json', JSON.stringify(tokens));
    console.log('トークンを保存しました');
    
    return tokens;
  } catch (error) {
    console.error('トークンの取得に失敗しました:', error);
  }
}

// 所要時間を計算する関数（分単位）
function calculateDuration(startObj, endObj) {
  // 終日イベントの場合
  if (startObj.date && endObj.date) {
    const startDate = new Date(startObj.date);
    const endDate = new Date(endObj.date);
    // 終日イベントの場合、終了日は次の日の0時を示すため1日引く
    const diffTime = endDate - startDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return {
      minutes: diffDays * 24 * 60,
      formatted: diffDays === 1 ? '終日' : `${diffDays}日間`
    };
  }
  
  // 通常のイベント
  const startTime = new Date(startObj.dateTime || startObj.date);
  const endTime = new Date(endObj.dateTime || endObj.date);
  const diffMinutes = Math.round((endTime - startTime) / (1000 * 60));
  
  // 時間と分に変換
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  let formatted = '';
  if (hours > 0) {
    formatted += `${hours}時間`;
  }
  if (minutes > 0 || hours === 0) {
    formatted += `${minutes}分`;
  }
  
  return {
    minutes: diffMinutes,
    formatted: formatted
  };
}

// カレンダーの予定を取得
async function listEvents(startDate, endDate, format = 'json') {
  try {
    // トークンが保存されていればロード
    if (fs.existsSync('tokens.json')) {
      const tokens = JSON.parse(fs.readFileSync('tokens.json'));
      oauth2Client.setCredentials(tokens);
    } else {
      console.log('先に認証を行ってください');
      getAuthUrl();
      return;
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = process.env.CALENDAR_ID || 'primary';
    
    // 開始日と終了日の設定
    let timeMin, timeMax;
    
    if (startDate && endDate) {
      timeMin = new Date(startDate);
      timeMax = new Date(endDate);
    } else {
      // デフォルトは現在の年の5月
      const now = new Date();
      const currentYear = now.getFullYear();
      timeMin = new Date(currentYear, 4, 1); // 5月1日（月は0-indexed）
      timeMax = new Date(currentYear, 4, 31); // 5月31日
    }
    
    const startInfo = {
      message: `${timeMin.getFullYear()}年${timeMin.getMonth() + 1}月${timeMin.getDate()}日から${timeMax.getFullYear()}年${timeMax.getMonth() + 1}月${timeMax.getDate()}日までの予定を取得します`,
      year: timeMin.getFullYear(),
      month: timeMin.getMonth() + 1,
      startDate: timeMin.toISOString(),
      endDate: timeMax.toISOString()
    };
    
    if (format === 'json') {
      console.log(JSON.stringify(startInfo));
    } else if (format === 'csv') {
      console.log(`期間,${startInfo.message}`);
    } else {
      console.log(startInfo.message);
    }
    
    const res = await calendar.events.list({
      calendarId: calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = res.data.items;
    if (events && events.length) {
      const formattedEvents = events.map((event) => {
        const start = event.start.dateTime || event.start.date;
        const startDate = new Date(start);
        const end = event.end.dateTime || event.end.date;
        const endDate = new Date(end);
        
        // 所要時間を計算
        const duration = calculateDuration(event.start, event.end);
        
        return {
          summary: event.summary || '名称なし',
          description: event.description || '',
          location: event.location || '',
          start: {
            dateTime: event.start.dateTime || null,
            date: event.start.date || null,
            formattedDate: event.start.dateTime ? 
              `${startDate.getMonth() + 1}月${startDate.getDate()}日 ${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')}` :
              `${startDate.getMonth() + 1}月${startDate.getDate()}日（終日）`
          },
          end: {
            dateTime: event.end.dateTime || null,
            date: event.end.date || null
          },
          duration: duration,
          isAllDay: !event.start.dateTime,
          htmlLink: event.htmlLink || '',
          status: event.status || '',
          creator: event.creator || {},
          attendees: event.attendees || []
        };
      });
      
      const result = {
        year: timeMin.getFullYear(),
        month: timeMin.getMonth() + 1,
        startDate: timeMin.toISOString(),
        endDate: timeMax.toISOString(),
        totalEvents: formattedEvents.length,
        events: formattedEvents
      };
      
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (format === 'csv') {
        // CSVヘッダーを出力
        console.log('日付,開始時間,終了時間,所要時間,タイトル,場所,説明');
        
        // イベントデータをCSV形式で出力
        formattedEvents.forEach(event => {
          const startDate = new Date(event.start.dateTime || event.start.date);
          const endDate = new Date(event.end.dateTime || event.end.date);
          
          const date = `${startDate.getFullYear()}/${startDate.getMonth() + 1}/${startDate.getDate()}`;
          
          let startTime = event.isAllDay ? '終日' : 
            `${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')}`;
          
          let endTime = event.isAllDay ? '終日' : 
            `${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`;
          
          // CSVでの特殊文字をエスケープ
          const summary = event.summary.replace(/"/g, '""');
          const location = event.location.replace(/"/g, '""');
          const description = event.description.replace(/"/g, '""');
          
          console.log(`${date},"${startTime}","${endTime}","${event.duration.formatted}","${summary}","${location}","${description}"`);
        });
      } else {
        // テキスト形式で出力
        console.log(`${timeMin.getFullYear()}年${timeMin.getMonth() + 1}月の予定:`);
        formattedEvents.forEach((event, i) => {
          const startDate = new Date(event.start.dateTime || event.start.date);
          console.log(`${event.start.formattedDate} - ${event.summary} (${event.duration.formatted})`);
        });
      }
    } else {
      if (format === 'json') {
        console.log(JSON.stringify({
          year: timeMin.getFullYear(),
          month: timeMin.getMonth() + 1,
          totalEvents: 0,
          events: [],
          message: '指定期間の予定は見つかりませんでした'
        }));
      } else if (format === 'csv') {
        console.log('指定期間の予定は見つかりませんでした');
      } else {
        console.log('指定期間の予定は見つかりませんでした');
      }
    }
  } catch (error) {
    console.error('予定の取得に失敗しました:', error);
    if (format === 'json') {
      console.error(JSON.stringify({
        error: {
          message: error.message,
          code: error.code
        }
      }));
    } else {
      console.error(error);
    }
  }
}

// ヘルプメッセージを表示
function showHelp() {
  console.log('使用方法:');
  console.log('認証URL取得: node index.js auth');
  console.log('トークン取得: node index.js token <認証コード>');
  console.log('予定一覧取得: node index.js events [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--format json|csv|text]');
  console.log('ヘルプ表示: node index.js help');
  console.log('\nオプション:');
  console.log('  --start YYYY-MM-DD   開始日を指定 (例: 2025-05-01)');
  console.log('  --end YYYY-MM-DD     終了日を指定 (例: 2025-05-31)');
  console.log('  --format FORMAT      出力形式を指定 (json, csv, text のいずれか、デフォルトはjson)');
}

// コマンドライン引数を解析
function parseArgs(args) {
  const options = {
    startDate: null,
    endDate: null,
    format: 'json'
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && i + 1 < args.length) {
      options.startDate = args[i + 1];
      i++;
    } else if (args[i] === '--end' && i + 1 < args.length) {
      options.endDate = args[i + 1];
      i++;
    } else if (args[i] === '--format' && i + 1 < args.length) {
      if (['json', 'csv', 'text'].includes(args[i + 1])) {
        options.format = args[i + 1];
      } else {
        console.error(`エラー: 無効なフォーマット '${args[i + 1]}' が指定されました。json, csv, text のいずれかを指定してください。`);
        process.exit(1);
      }
      i++;
    }
  }
  
  return options;
}

// コマンドライン引数で機能を切り替え
const args = process.argv.slice(2);
const command = args[0];

if (command === 'auth') {
  getAuthUrl();
} else if (command === 'token' && args[1]) {
  getTokenFromCode(args[1]);
} else if (command === 'events') {
  const options = parseArgs(args.slice(1));
  listEvents(options.startDate, options.endDate, options.format);
} else if (command === 'help') {
  showHelp();
} else {
  showHelp();
} 