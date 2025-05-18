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

// 分を時間と分に変換して整形する関数
function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  let formatted = '';
  if (hours > 0) {
    formatted += `${hours}時間`;
  }
  if (minutes > 0 || hours === 0) {
    formatted += `${minutes}分`;
  }
  
  return formatted;
}

// 日付をYYYY-MM-DD形式に変換する関数
function formatDateYMD(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 日付を日本語形式に変換する関数
function formatDateJP(date) {
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// イベントを除外キーワードでフィルタリングする関数
function filterEventsByExcludeKeywords(events, excludeKeywords, excludeMode = 'contains') {
  if (!excludeKeywords || excludeKeywords.length === 0) {
    return events;
  }
  
  // excludeModeに応じたマッチング関数を作成
  const matchesKeyword = (text, keyword) => {
    if (!text || !keyword) return false;
    
    switch (excludeMode) {
      case 'exact':
        // 完全一致
        return text === keyword;
      
      case 'word':
        // 単語単位のマッチング
        const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
        return regex.test(text);
      
      case 'any':
        // いずれかの単語がマッチ（スペース区切りの各単語）
        const words = keyword.split(/\s+/).filter(w => w.length > 0);
        // 各単語について、テキストに含まれているかをチェック
        for (const word of words) {
          if (text.includes(word)) {
            return true;
          }
        }
        return false;
      
      case 'all':
        // すべての単語がマッチ（スペース区切りの各単語）
        const allWords = keyword.split(/\s+/).filter(w => w.length > 0);
        return allWords.every(word => text.includes(word));
      
      case 'regex':
        // 正規表現
        try {
          const regexObj = new RegExp(keyword, 'i');
          return regexObj.test(text);
        } catch (e) {
          console.error(`無効な正規表現: ${keyword}`);
          return false;
        }
      
      case 'contains':
      default:
        // 部分一致（デフォルト）
        return text.includes(keyword);
    }
  };
  
  // 正規表現でのエスケープ用関数
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  return events.filter(event => {
    // イベントの概要、説明、場所のいずれかに除外キーワードが含まれているか確認
    const summary = event.summary || '';
    const description = event.description || '';
    const location = event.location || '';
    
    // 全てのキーワードについてチェック
    for (const keyword of excludeKeywords) {
      if (keyword && (
        matchesKeyword(summary, keyword) || 
        matchesKeyword(description, keyword) || 
        matchesKeyword(location, keyword)
      )) {
        return false; // 除外キーワードが含まれている場合は除外
      }
    }
    
    return true; // 除外キーワードが含まれていない場合は保持
  });
}

// 週の開始日を取得する関数（日曜日起点）
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0: 日曜日, 1: 月曜日, ...
  d.setDate(d.getDate() - day); // 日曜日に調整
  return d;
}

// 週の表示用文字列を作成する関数
function formatWeekRange(startDate) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6); // 週の終わり（土曜日）

  const startStr = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`;
  const endStr = `${endDate.getFullYear()}年${endDate.getMonth() + 1}月${endDate.getDate()}日`;
  
  return `${startStr} 〜 ${endStr}`;
}

// 月の表示用文字列を作成する関数
function formatMonth(date) {
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

// 月の最初の日を取得する関数
function getMonthStart(date) {
  const d = new Date(date);
  d.setDate(1);
  return d;
}

// 月の識別子を取得する関数
function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// カレンダーの予定を取得
async function listEvents(startDate, endDate, format = 'json', summary = null, excludeKeywords = [], excludeMode = 'contains') {
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
    
    if (summary !== 'daily' && summary !== 'weekly' && summary !== 'monthly') {
      if (format === 'json') {
        console.log(JSON.stringify(startInfo));
      } else if (format === 'csv') {
        console.log(`期間,${startInfo.message}`);
      } else {
        console.log(startInfo.message);
      }
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
      // 除外キーワードでフィルタリング
      const filteredEvents = filterEventsByExcludeKeywords(events, excludeKeywords, excludeMode);
      
      // 除外情報を表示
      if (excludeKeywords && excludeKeywords.length > 0 && events.length !== filteredEvents.length) {
        const excludedCount = events.length - filteredEvents.length;
        const excludeModeText = {
          'contains': '部分一致',
          'exact': '完全一致',
          'word': '単語一致',
          'any': 'いずれかの単語一致',
          'all': 'すべての単語一致',
          'regex': '正規表現'
        }[excludeMode] || '部分一致';
        
        if (format === 'json') {
          console.log(JSON.stringify({
            excludeInfo: {
              keywords: excludeKeywords,
              mode: excludeMode,
              modeText: excludeModeText,
              excludedCount: excludedCount,
              message: `${excludeModeText}モードで${excludedCount}件のイベントが除外されました`
            }
          }));
        } else if (format !== 'csv') {
          console.log(`除外キーワード [${excludeKeywords.join(', ')}] が${excludeModeText}モードで${excludedCount}件のイベントを除外しました`);
        }
      }
      
      const formattedEvents = filteredEvents.map((event) => {
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
      
      // 日別集計が指定されている場合
      if (summary === 'daily') {
        // 日別の合計時間を計算
        const dailySummary = {};
        
        formattedEvents.forEach(event => {
          const startDate = new Date(event.start.dateTime || event.start.date);
          const dateKey = formatDateYMD(startDate);
          
          if (!dailySummary[dateKey]) {
            dailySummary[dateKey] = {
              date: dateKey,
              formattedDate: formatDateJP(startDate),
              totalMinutes: 0,
              events: 0
            };
          }
          
          // 終日イベントは集計しない（オプションで変更可能）
          if (!event.isAllDay) {
            dailySummary[dateKey].totalMinutes += event.duration.minutes;
          }
          dailySummary[dateKey].events += 1;
        });
        
        // 日別集計結果をソートして出力
        const sortedDailySummary = Object.values(dailySummary).sort((a, b) => a.date.localeCompare(b.date));
        
        // 合計時間を計算
        const totalMinutes = sortedDailySummary.reduce((sum, day) => sum + day.totalMinutes, 0);
        
        if (format === 'json') {
          // 各日にフォーマットされた時間を追加
          sortedDailySummary.forEach(day => {
            day.formattedDuration = formatMinutes(day.totalMinutes);
          });
          
          console.log(JSON.stringify({
            period: startInfo.message,
            totalDays: sortedDailySummary.length,
            totalEvents: formattedEvents.length,
            totalMinutes: totalMinutes,
            totalFormatted: formatMinutes(totalMinutes),
            excludeKeywords: excludeKeywords,
            excludeMode: excludeMode,
            dailySummary: sortedDailySummary
          }, null, 2));
        } else if (format === 'csv') {
          console.log('日付,予定数,合計時間');
          sortedDailySummary.forEach(day => {
            console.log(`${day.date},${day.events},${formatMinutes(day.totalMinutes)}`);
          });
          console.log(`合計,${formattedEvents.length},${formatMinutes(totalMinutes)}`);
        } else {
          console.log(`${startInfo.message}`);
          console.log(`日別集計（合計：${formatMinutes(totalMinutes)}、${formattedEvents.length}件）`);
          sortedDailySummary.forEach(day => {
            console.log(`${day.formattedDate}: ${formatMinutes(day.totalMinutes)}（${day.events}件）`);
          });
        }
        
        return;
      }
      
      // 週別集計が指定されている場合
      if (summary === 'weekly') {
        // 週別の合計時間を計算
        const weeklySummary = {};
        
        formattedEvents.forEach(event => {
          const startDate = new Date(event.start.dateTime || event.start.date);
          const weekStart = getWeekStart(startDate);
          const weekKey = formatDateYMD(weekStart);
          
          if (!weeklySummary[weekKey]) {
            weeklySummary[weekKey] = {
              weekStart: weekKey,
              formattedWeek: formatWeekRange(weekStart),
              totalMinutes: 0,
              events: 0
            };
          }
          
          // 終日イベントは集計しない（オプションで変更可能）
          if (!event.isAllDay) {
            weeklySummary[weekKey].totalMinutes += event.duration.minutes;
          }
          weeklySummary[weekKey].events += 1;
        });
        
        // 週別集計結果をソートして出力
        const sortedWeeklySummary = Object.values(weeklySummary).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
        
        // 合計時間を計算
        const totalMinutes = sortedWeeklySummary.reduce((sum, week) => sum + week.totalMinutes, 0);
        
        if (format === 'json') {
          // 各週にフォーマットされた時間を追加
          sortedWeeklySummary.forEach(week => {
            week.formattedDuration = formatMinutes(week.totalMinutes);
          });
          
          console.log(JSON.stringify({
            period: startInfo.message,
            totalWeeks: sortedWeeklySummary.length,
            totalEvents: formattedEvents.length,
            totalMinutes: totalMinutes,
            totalFormatted: formatMinutes(totalMinutes),
            excludeKeywords: excludeKeywords,
            excludeMode: excludeMode,
            weeklySummary: sortedWeeklySummary
          }, null, 2));
        } else if (format === 'csv') {
          console.log('週,予定数,合計時間');
          sortedWeeklySummary.forEach(week => {
            console.log(`${week.weekStart},${week.events},${formatMinutes(week.totalMinutes)}`);
          });
          console.log(`合計,${formattedEvents.length},${formatMinutes(totalMinutes)}`);
        } else {
          console.log(`${startInfo.message}`);
          console.log(`週別集計（合計：${formatMinutes(totalMinutes)}、${formattedEvents.length}件）`);
          sortedWeeklySummary.forEach(week => {
            console.log(`${week.formattedWeek}: ${formatMinutes(week.totalMinutes)}（${week.events}件）`);
          });
        }
        
        return;
      }
      
      // 月別集計が指定されている場合
      if (summary === 'monthly') {
        // 月別の合計時間を計算
        const monthlySummary = {};
        
        formattedEvents.forEach(event => {
          const startDate = new Date(event.start.dateTime || event.start.date);
          const monthKey = getMonthKey(startDate);
          
          if (!monthlySummary[monthKey]) {
            monthlySummary[monthKey] = {
              month: monthKey,
              formattedMonth: formatMonth(startDate),
              totalMinutes: 0,
              events: 0
            };
          }
          
          // 終日イベントは集計しない（オプションで変更可能）
          if (!event.isAllDay) {
            monthlySummary[monthKey].totalMinutes += event.duration.minutes;
          }
          monthlySummary[monthKey].events += 1;
        });
        
        // 月別集計結果をソートして出力
        const sortedMonthlySummary = Object.values(monthlySummary).sort((a, b) => a.month.localeCompare(b.month));
        
        // 合計時間を計算
        const totalMinutes = sortedMonthlySummary.reduce((sum, month) => sum + month.totalMinutes, 0);
        
        if (format === 'json') {
          // 各月にフォーマットされた時間を追加
          sortedMonthlySummary.forEach(month => {
            month.formattedDuration = formatMinutes(month.totalMinutes);
          });
          
          console.log(JSON.stringify({
            period: startInfo.message,
            totalMonths: sortedMonthlySummary.length,
            totalEvents: formattedEvents.length,
            totalMinutes: totalMinutes,
            totalFormatted: formatMinutes(totalMinutes),
            excludeKeywords: excludeKeywords,
            excludeMode: excludeMode,
            monthlySummary: sortedMonthlySummary
          }, null, 2));
        } else if (format === 'csv') {
          console.log('月,予定数,合計時間');
          sortedMonthlySummary.forEach(month => {
            console.log(`${month.month},${month.events},${formatMinutes(month.totalMinutes)}`);
          });
          console.log(`合計,${formattedEvents.length},${formatMinutes(totalMinutes)}`);
        } else {
          console.log(`${startInfo.message}`);
          console.log(`月別集計（合計：${formatMinutes(totalMinutes)}、${formattedEvents.length}件）`);
          sortedMonthlySummary.forEach(month => {
            console.log(`${month.formattedMonth}: ${formatMinutes(month.totalMinutes)}（${month.events}件）`);
          });
        }
        
        return;
      }
      
      const result = {
        year: timeMin.getFullYear(),
        month: timeMin.getMonth() + 1,
        startDate: timeMin.toISOString(),
        endDate: timeMax.toISOString(),
        totalEvents: formattedEvents.length,
        excludeKeywords: excludeKeywords,
        excludeMode: excludeMode,
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
          excludeKeywords: excludeKeywords,
          excludeMode: excludeMode,
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
  console.log('予定一覧取得: node index.js events [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--format json|csv|text] [--summary daily|weekly|monthly] [--exclude keyword1,keyword2,...] [--exclude-mode contains|exact|word|any|all|regex]');
  console.log('ヘルプ表示: node index.js help');
  console.log('\nオプション:');
  console.log('  --start YYYY-MM-DD     開始日を指定 (例: 2025-05-01)');
  console.log('  --end YYYY-MM-DD       終了日を指定 (例: 2025-05-31)');
  console.log('  --format FORMAT        出力形式を指定 (json, csv, text のいずれか、デフォルトはjson)');
  console.log('  --summary TYPE         集計タイプを指定:');
  console.log('                           daily: 日別の時間集計を表示');
  console.log('                           weekly: 週別の時間集計を表示');
  console.log('                           monthly: 月別の時間集計を表示');
  console.log('  --exclude KEYWORDS     指定したキーワードを含むイベントを除外 (カンマ区切りで複数指定可能)');
  console.log('  --exclude-mode MODE    除外キーワードのマッチングモードを指定:');
  console.log('                           contains: 部分一致（デフォルト）');
  console.log('                           exact: 完全一致');
  console.log('                           word: 単語単位で一致');
  console.log('                           any: スペース区切りの単語のいずれかが一致');
  console.log('                           all: スペース区切りの単語全てが一致');
  console.log('                           regex: 正規表現');
}

// コマンドライン引数を解析
function parseArgs(args) {
  const options = {
    startDate: null,
    endDate: null,
    format: 'json',
    summary: null,
    excludeKeywords: [],
    excludeMode: 'contains'
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase(); // 小文字に変換して比較
    
    if (arg === '--start' && i + 1 < args.length) {
      options.startDate = args[i + 1];
      i++;
    } else if (arg === '--end' && i + 1 < args.length) {
      options.endDate = args[i + 1];
      i++;
    } else if (arg === '--format' && i + 1 < args.length) {
      if (['json', 'csv', 'text'].includes(args[i + 1].toLowerCase())) {
        options.format = args[i + 1].toLowerCase();
      } else {
        console.error(`エラー: 無効なフォーマット '${args[i + 1]}' が指定されました。json, csv, text のいずれかを指定してください。`);
        process.exit(1);
      }
      i++;
    } else if (arg === '--summary' && i + 1 < args.length) {
      const validSummaryTypes = ['daily', 'weekly', 'monthly'];
      const summaryType = args[i + 1].toLowerCase();
      if (validSummaryTypes.includes(summaryType)) {
        options.summary = summaryType;
      } else {
        console.error(`エラー: 無効な集計タイプ '${args[i + 1]}' が指定されました。${validSummaryTypes.join(', ')} のいずれかを指定してください。`);
        process.exit(1);
      }
      i++;
    } else if ((arg === '--exclude' || arg === '--excludes' || arg === '---excludes' || arg === '---exclude') && i + 1 < args.length) {
      // カンマ区切りで複数のキーワードを指定可能
      options.excludeKeywords = args[i + 1].split(',').map(k => k.trim()).filter(k => k.length > 0);
      i++;
    } else if ((arg === '--exclude-mode' || arg === '--excludemode') && i + 1 < args.length) {
      const validModes = ['contains', 'exact', 'word', 'any', 'all', 'regex'];
      const mode = args[i + 1].toLowerCase();
      if (validModes.includes(mode)) {
        options.excludeMode = mode;
      } else {
        console.error(`エラー: 無効な除外モード '${args[i + 1]}' が指定されました。${validModes.join(', ')} のいずれかを指定してください。`);
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
  listEvents(options.startDate, options.endDate, options.format, options.summary, options.excludeKeywords, options.excludeMode);
} else if (command === 'help') {
  showHelp();
} else {
  showHelp();
} 