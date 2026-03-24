# 文字轉語音 (Text-to-Speech MVP)

多引擎 AI 文字轉語音應用，支援瀏覽器內建語音（免費）和 OpenAI / ElevenLabs / Kokoro 雲端引擎。

**線上體驗**: https://text-to-speech-mvp.vercel.app/

---

## 功能特色

- **多引擎支援**: Web Speech API（免費）、OpenAI gpt-4o-mini-tts、ElevenLabs Multilingual v2、inference.sh Kokoro
- **多語言**: 中文（簡體/繁體）、英文、日文、韓文
- **檔案上傳**: 支援 .txt、.srt、.vtt、.lrc、.epub、.docx、.pdf
- **聲音預覽**: 使用 Web Speech API 即時預覽各聲音
- **歷史記錄**: 最近 10 筆記錄，點擊即可載入
- **語速/音調/音量控制**
- **響應式設計**: 支援手機和桌面

---

## 引擎與聲音

### 聲音對照表（前端 → 各引擎）

| 前端代碼 | 說明       | OpenAI | ElevenLabs | Kokoro        |
|----------|-----------|--------|-------------|---------------|
| zh-CN    | 中文-女   | alloy  | Rachel      | zh-CN-female  |
| zh-TW    | 中文-男   | alloy  | Rachel      | zh-CN-female  |
| en-US    | 英文-女   | alloy  | Rachel      | en-US-female  |
| en-US-male | 英文-男 | onyx   | Marcus      | en-US-male    |
| ja-JP    | 日文-女   | nova   | Rachel      | ja-JP-female  |
| ko-KR    | 韓文-女   | fable  | Rachel      | ko-KR-female  |

### Kokoro 聲音架構

Kokoro (inference.sh) 的聲音命名格式：

```
[語言前綴]_[性別/類型]
af_* = American Female,  bf_* = British Female
am_* = American Male,    bm_* = British Male
```

---

## 環境變數（後端）

在 Vercel 專案設定中設定以下環境變數：

| 變數                    | 必填 | 說明                              |
|------------------------|------|----------------------------------|
| `OPENAI_API_KEY`       | 若使用 OpenAI 引擎 | OpenAI API Key  |
| `ELEVENLABS_API_KEY`   | 若使用 ElevenLabs | ElevenLabs API Key |
| `KOKORO_API_KEY`       | 若使用 Kokoro 引擎 | inference.sh API Key |
| `KOKORO_APP_ID`        | 否   | inference.sh App ID（預設 `kokoro`）|
| `KOKORO_API_URL`       | 否   | Kokoro API URL（進階）           |

---

## 部署

### Vercel 部署

```bash
npm i -g vercel
vercel login
vercel --prod
```

### 本地開發

```bash
npm install
vercel dev
```

---

## API

### POST /api/tts

```json
{
  "text": "要轉換的文字（最多 5000 字）",
  "engine": "openai | elevenlabs | kokoro",
  "voice": "前端聲音代碼（可選）",
  "speed": 1.0,
  "plan": "free | starter | pro"
}
```

### GET /api/health

健康檢查端點。

---

## 速率限制

| 方案   | 每日限制 |
|--------|---------|
| 免費   | 10 次   |
| Starter| 100 次  |
| Pro    | 1000 次 |

---

## 技術棧

- **前端**: HTML5 + CSS3 + Vanilla JS（無框架依賴）
- **後端**: Node.js + Vercel Serverless Functions
- **TTS 引擎**: OpenAI gpt-4o-mini-tts、ElevenLabs Multilingual v2、inference.sh Kokoro
- **字體**: Google Noto Sans TC
