var enLocale = {
  "app": {
    "title": "🎤 Text to Speech v2.0",
    "subtitle": "Multi-Engine AI Text-to-Speech",
    "version": "v2.0 - Multi-Engine Backend"
  },
  "upload": {
    "title": "📁 Upload File",
    "dropzone": "Click or drag files here",
    "parsing": "Parsing...",
    "done": "Done",
    "loaded": "Loaded",
    "truncated": "File content truncated to 5000 characters",
    "unsupported": "Unsupported file format",
    "readError": "File read failed"
  },
  "mode": {
    "title": "🔊 Conversion Mode",
    "browser": {
      "label": "🌐 Browser Built-in",
      "sub": "Free, instant"
    },
    "api": {
      "label": "🤖 AI Cloud Engine",
      "sub": "High quality, Key required"
    }
  },
  "engine": {
    "selectEngine": "Select TTS Engine",
    "selectPlan": "Select Plan",
    "apiKeyPlaceholder": "Enter API Key (optional, uses backend env vars)",
    "openai": {
      "name": "🎙️ OpenAI",
      "tag": "gpt-4o-mini-tts",
      "note": "<strong>OpenAI:</strong> Requires backend <code>OPENAI_API_KEY</code> env var"
    },
    "elevenlabs": {
      "name": "🎧 ElevenLabs",
      "tag": "Multilingual v2",
      "note": "<strong>ElevenLabs:</strong> Requires backend <code>ELEVENLABS_API_KEY</code>"
    },
    "kokoro": {
      "name": "🔉 Kokoro",
      "tag": "inference.sh",
      "note": "<strong>Kokoro:</strong> Supports direct Key input or backend env var"
    }
  },
  "plan": {
    "free": "Free",
    "starter": "Starter",
    "pro": "Pro",
    "freeLimit": "10/day",
    "starterLimit": "100/day",
    "proLimit": "1000/day"
  },
  "text": {
    "charCount": "/5000 chars",
    "placeholder": "Enter text to convert, or upload a file...",
    "estimated": "Est. duration: ",
    "segments": "Segments: ",
    "sec": "sec",
    "noPreview": "No segment preview yet"
  },
  "voice": {
    "title": "Select Voice",
    "preview": "▶ Preview",
    "previewText": "Hello, this is a voice preview."
  },
  "speed": {
    "title": "Speed Presets",
    "speed": "Speed",
    "pitch": "Pitch",
    "volume": "Volume"
  },
  "convert": {
    "button": "🔊 Convert to Speech",
    "converting": "⏳ Converting..."
  },
  "status": {
    "browserMode": "🌐 Browser built-in speech (free)",
    "usingEngine": "🌐 Using {engine} engine",
    "success": "✅ {message}",
    "error": "❌ {message}",
    "info": "ℹ️ {message}",
    "warn": "⚠️ {message}"
  },
  "result": {
    "complete": "🎉 Conversion Complete!",
    "download": "⬇️ Download Audio",
    "playing": "✅ Playing... (Browser mode only supports online playback. Switch to OpenAI/ElevenLabs to download audio)",
    "noAudio": "No audio available to download",
    "downloadStarted": "⬇️ Download started!",
    "downloadHint": "Browser mode only supports online playback. Switch to OpenAI / ElevenLabs / Kokoro engine to download audio."
  },
  "history": {
    "title": "Conversion History",
    "clear": "Clear",
    "empty": "No conversion history yet",
    "loaded": "History loaded ({time})",
    "confirmClear": "Clear all history?"
  },
  "errors": {
    "empty": "Please enter text or upload a file",
    "tooLong": "Text cannot exceed 5000 characters. Current: {count}",
    "noApiKey": "Please enter API Key or confirm backend env vars are set",
    "invalidApiKey": "API Key is invalid. Please check your Key.",
    "rateLimit": "Rate limit exceeded. Please try again later (or switch engines).",
    "quotaExhausted": "API quota exhausted. Please try tomorrow or upgrade plan.",
    "networkFailed": "Network connection failed. Please check backend service.",
    "serverError": "Backend server error. Please try again later.",
    "unknown": "Unknown error"
  },
  "loading": {
    "text": "⏳ Converting...",
    "sub": "Using {engine} engine"
  },
  "voicenames": {
    "zh-CN": "Xiaoxiao",
    "zh-TW": "Yunxi",
    "en-US": "Jenny",
    "ja-JP": "Nanami",
    "ko-KR": "SunHi",
    "en-US-male": "James"
  },
  "voicelabels": {
    "zh-CN": "Chinese-Female",
    "zh-TW": "Chinese-Male",
    "en-US": "English-Female",
    "ja-JP": "Japanese-Female",
    "ko-KR": "Korean-Female",
    "en-US-male": "English-Male"
  }
}
