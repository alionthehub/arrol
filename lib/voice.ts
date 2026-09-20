import { listEnabledModels } from "@/lib/models";
import { sanitizeProviderError } from "@/lib/agent/types";
import { TTS_FORMAT_PCM, TTS_PCM_RATE } from "@/lib/voice-format";

const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const OPENAI_AUDIO = "https://api.openai.com/v1/audio/transcriptions";
const ELEVENLABS_TTS = "https://api.elevenlabs.io/v1/text-to-speech";
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function resolveOpenAiApiKey() {
  const direct = process.env.OPENAI_API_KEY;
  if (direct) return direct;

  const models = await listEnabledModels().catch(() => []);
  for (const model of models) {
    if (model.provider_type !== "openai-compatible") continue;
    const base = (model.base_url || "https://api.openai.com/v1").toLowerCase();
    if (!base.includes("api.openai.com")) continue;
    const value = process.env[model.key_env_var];
    if (value) return value;
  }
  return undefined;
}

export function elevenLabsConfig() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set.");
  }
  if (!voiceId || !/^[a-zA-Z0-9_-]+$/.test(voiceId)) {
    throw new Error("ELEVENLABS_VOICE_ID is missing or invalid.");
  }
  return { apiKey, voiceId };
}

export async function transcribeAudio(file: File) {
  if (file.size <= 0) {
    throw new Error("Empty recording.");
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("Recording too large.");
  }

  const apiKey = await resolveOpenAiApiKey();
  if (!apiKey) {
    throw new Error("No OpenAI key for transcription. Set OPENAI_API_KEY.");
  }

  const filename = "speech.webm";
  const type = "audio/webm";
  const upload = new File([file], filename, { type });
  console.info("[arrol-voice] openai request", {
    name: filename,
    bytes: upload.size,
    mimeType: type,
    model: TRANSCRIBE_MODEL,
    language: "en",
  });
  const body = new FormData();
  body.append("model", TRANSCRIBE_MODEL);
  body.append("file", upload, filename);
  body.append("language", "en");

  const response = await fetch(OPENAI_AUDIO, {
    method: "POST",
    cache: "no-store",
    headers: { authorization: `Bearer ${apiKey}` },
    body,
  });
  const raw = await response.text();
  console.info("[arrol-voice] openai raw", {
    status: response.status,
    body: raw.slice(0, 2000),
  });
  if (!response.ok) {
    throw new Error(
      sanitizeProviderError(
        `Transcribe failed (${response.status}): ${raw.slice(0, 400)}`,
        apiKey,
      ),
    );
  }

  const parsed = JSON.parse(raw) as { text?: unknown };
  const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
  if (!text) {
    throw new Error(
      `No speech heard. (${file.size} bytes, ${file.type || "unknown type"})`,
    );
  }
  return text;
}

export function speechText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#]+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function streamElevenLabsSpeech(text: string) {
  const spoken = speechText(text);
  if (!spoken) {
    throw new Error("Nothing to speak.");
  }

  const { apiKey, voiceId } = elevenLabsConfig();
  const url = new URL(`${ELEVENLABS_TTS}/${voiceId}/stream`);
  url.searchParams.set("output_format", `pcm_${TTS_PCM_RATE}`);
  url.searchParams.set("optimize_streaming_latency", "3");

  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "application/octet-stream",
    },
    body: JSON.stringify({
      text: spoken,
      model_id: "eleven_flash_v2_5",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.05,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok || !response.body) {
    const raw = await response.text().catch(() => "");
    throw new Error(
      sanitizeProviderError(
        `ElevenLabs failed (${response.status}): ${raw.slice(0, 400)}`,
        apiKey,
      ),
    );
  }

  return new Response(response.body, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
      "x-arrol-audio": TTS_FORMAT_PCM,
    },
  });
}
