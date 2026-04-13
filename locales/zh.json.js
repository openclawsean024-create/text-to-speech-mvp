var zhLocale = {
  "app": {
    "title": "🎤 文字轉語音 v2.0",
    "subtitle": "支援多引擎 AI 文字轉語音",
    "version": "v2.0 - 多引擎後端"
  },
  "upload": {
    "title": "📁 上傳檔案",
    "dropzone": "點擊或拖曳檔案至此",
    "parsing": "正在解析中...",
    "done": "已完成",
    "loaded": "已載入",
    "truncated": "檔案內容已截斷至 5000 字",
    "unsupported": "不支援的檔案格式",
    "readError": "檔案讀取失敗"
  },
  "mode": {
    "title": "🔊 轉換模式",
    "browser": {
      "label": "🌐 瀏覽器內建",
      "sub": "免費，立即使用"
    },
    "api": {
      "label": "🤖 AI 雲端引擎",
      "sub": "高品質，需設定 Key"
    }
  },
  "engine": {
    "selectEngine": "選擇 TTS 引擎",
    "selectPlan": "選擇方案",
    "apiKeyPlaceholder": "輸入 API Key（可留空，使用後端環境變數）",
    "openai": {
      "name": "🎙️ OpenAI",
      "tag": "gpt-4o-mini-tts",
      "note": "<strong>OpenAI:</strong> 需設定後端 <code>OPENAI_API_KEY</code> 環境變數"
    },
    "elevenlabs": {
      "name": "🎧 ElevenLabs",
      "tag": "Multilingual v2",
      "note": "<strong>ElevenLabs:</strong> 需後端 <code>ELEVENLABS_API_KEY</code>"
    },
    "kokoro": {
      "name": "🔉 Kokoro",
      "tag": "inference.sh",
      "note": "<strong>Kokoro:</strong> 支援直接填入 Key 或使用後端環境變數"
    }
  },
  "plan": {
    "free": "免費",
    "starter": "Starter",
    "pro": "Pro",
    "freeLimit": "10次/天",
    "starterLimit": "100次/天",
    "proLimit": "1000次/天"
  },
  "text": {
    "charCount": "/5000 字",
    "placeholder": "請輸入要轉換的文字，或上傳檔案...",
    "estimated": "預估時長：",
    "segments": "分段：",
    "sec": "秒",
    "noPreview": "尚未產生段落預覽"
  },
  "voice": {
    "title": "選擇聲音",
    "preview": "▶ 試聽",
    "previewText": "您好，這是聲音預覽。"
  },
  "speed": {
    "title": "語速預設",
    "speed": "語速",
    "pitch": "音調",
    "volume": "音量"
  },
  "convert": {
    "button": "🔊 開始轉換",
    "converting": "⏳ 轉換中..."
  },
  "status": {
    "browserMode": "🌐 瀏覽器內建語音（免費）",
    "usingEngine": "🌐 使用 {engine} 引擎",
    "success": "✅ {message}",
    "error": "❌ {message}",
    "info": "ℹ️ {message}",
    "warn": "⚠️ {message}"
  },
  "result": {
    "complete": "🎉 轉換完成！",
    "download": "⬇️ 下載音頻",
    "playing": "✅ 播放中...（瀏覽器模式僅支援線上播放，建議切換至 OpenAI/ElevenLabs 可下載音檔）",
    "noAudio": "沒有可下載的音頻",
    "downloadStarted": "⬇️ 下載開始！",
    "downloadHint": "瀏覽器模式僅支援線上播放，請切換至 OpenAI / ElevenLabs / Kokoro 引擎以下載音檔"
  },
  "history": {
    "title": "轉換歷史",
    "clear": "清除",
    "empty": "尚無轉換記錄",
    "loaded": "已載入歷史記錄（{time}）",
    "confirmClear": "確定清除所有歷史記錄？"
  },
  "errors": {
    "empty": "請輸入文字或上傳檔案",
    "tooLong": "文字不能超過 5000 字，目前：{count} 字",
    "noApiKey": "請輸入 API Key，或確認後端已設定環境變數",
    "invalidApiKey": "API Key 無效，請檢查 Key 是否正確",
    "rateLimit": "速率限制，請稍後再試（建議使用其他引擎）",
    "quotaExhausted": "API 配額已用盡，請明天再試或更換方案",
    "networkFailed": "網路連線失敗，請確認後端服務正常運行",
    "serverError": "後端伺服器錯誤，請稍後再試",
    "unknown": "未知錯誤"
  },
  "loading": {
    "text": "⏳ 正在轉換...",
    "sub": "使用 {engine} 引擎"
  },
  "voicenames": {
    "zh-CN": "曉曉",
    "zh-TW": "雲希",
    "en-US": "Jenny",
    "ja-JP": "七海",
    "ko-KR": "SunHi",
    "en-US-male": "James"
  },
  "voicelabels": {
    "zh-CN": "中文-女",
    "zh-TW": "中文-男",
    "en-US": "英文-女",
    "ja-JP": "日文-女",
    "ko-KR": "韓文-女",
    "en-US-male": "英文-男"
  },
  "h1_title": "🎤 文字轉語音 v2.0",
  "h1_subtitle": "支援多引擎 AI 文字轉語音",
  "dropzone": "點擊或拖曳檔案至此",
  "chunkLabel": "分段：",
  "estDurationLabel": "預估時長：",
  "sec": " 秒",
  "noHistory": "尚無轉換記錄",
  "enterText": "請輸入文字或上傳檔案",
  "textTooLong": "文字超過 5000 字上限（目前：",
  "parsingPdf": "正在解析 PDF...",
  "parsingDocx": "正在解析 DOCX...",
  "parsingEpub": "正在解析 EPUB...",
  "fileTruncated": "檔案已截斷至 5000 字",
  "fileReadFailed": "檔案讀取失敗：",
  "fileReadError": "檔案讀取錯誤",
  "epubParseFailed": "EPUB 解析失敗",
  "convertComplete": "轉換完成",
  "unknownError": "未知錯誤",
  "networkError": "網路連線失敗，請稍後再試",
  "serverError": "伺服器錯誤，請稍後再試",
  "engineBrowser": "🌐 瀏覽器內建（免費）",
  "browserNoDownload": "瀏覽器模式不支援下載。請切換至 OpenAI / ElevenLabs / Kokoro 引擎以下載音檔。",
  "historyLoaded": "✅ 已載入歷史記錄（",
  "clearConfirm": "確定清除所有歷史記錄？",
  "placeholder": "請輸入要轉換的文字，或上傳檔案...",
  "chunkPreviewPlaceholder": "尚未產生段落預覽"
}
