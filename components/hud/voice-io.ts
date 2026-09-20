import { TTS_PCM_RATE } from "@/lib/voice-format";
import {
  loadMicChoice,
  micConstraints,
  micDisplayName,
} from "@/components/hud/mic-device";

export const WEBM_OPUS = "audio/webm;codecs=opus";
export const WEBM_TYPE = "audio/webm";
export const WEBM_FILENAME = "speech.webm";

function audioContextCtor() {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function pickWebmOpusMime() {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported(WEBM_OPUS)) return WEBM_OPUS;
  if (MediaRecorder.isTypeSupported(WEBM_TYPE)) return WEBM_TYPE;
  return "";
}

export function webmFileFromBlob(blob: Blob) {
  return new File([blob], WEBM_FILENAME, { type: WEBM_TYPE });
}

function logVoice(label: string, data: Record<string, unknown>) {
  console.info(`[arrol-voice] ${label}`, data);
}

export function createHudAudioContext() {
  const Ctor = audioContextCtor();
  if (!Ctor) throw new Error("No audio context.");
  return new Ctor();
}

function describeTrack(track: MediaStreamTrack) {
  const settings = track.getSettings();
  return {
    id: track.id,
    kind: track.kind,
    label: track.label || "(no label)",
    readyState: track.readyState,
    enabled: track.enabled,
    muted: track.muted,
    sampleRate: settings.sampleRate ?? null,
    channelCount: settings.channelCount ?? null,
    deviceId: settings.deviceId ?? null,
  };
}

export class MicRecorder {
  readonly analyser: AnalyserNode;
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private chunkIndex = 0;
  private startedAt = 0;
  private deviceLabel = "microphone";

  constructor(ctx: AudioContext) {
    // Isolation: analyser exists for the HUD API but is NOT connected to the
    // mic stream. Connecting createMediaStreamSource on the same stream
    // MediaRecorder uses often yields a ~1KB header with no audio.
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.28;
  }

  async start(deviceId?: string) {
    const mime = pickWebmOpusMime();
    if (!mime) {
      throw new Error("This browser cannot record audio/webm;codecs=opus.");
    }
    const saved = loadMicChoice();
    const requested = deviceId ?? saved.deviceId;
    this.deviceLabel = micDisplayName(saved.label);
    this.release();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(
        micConstraints(requested),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "OverconstrainedError") {
        throw new Error(
          `Could not open ${this.deviceLabel}. Pick another microphone in settings.`,
        );
      }
      throw error;
    }
    const tracks = this.stream.getAudioTracks();
    const trackLabel = tracks[0]?.label;
    this.deviceLabel = micDisplayName(trackLabel, saved.label);
    for (const track of tracks) {
      logVoice("track at start", describeTrack(track));
      track.onmute = () => logVoice("track mute", describeTrack(track));
      track.onunmute = () => logVoice("track unmute", describeTrack(track));
      track.onended = () => logVoice("track ended", describeTrack(track));
    }
    const live = tracks.filter((track) => track.readyState === "live" && track.enabled);
    if (live.length === 0) {
      throw new Error(`no audio from ${this.deviceLabel} — check your microphone`);
    }

    this.chunks = [];
    this.chunkIndex = 0;
    this.startedAt = performance.now();
    this.rec = new MediaRecorder(this.stream, { mimeType: mime });
    this.rec.ondataavailable = (event) => {
      this.chunkIndex += 1;
      logVoice("dataavailable", {
        index: this.chunkIndex,
        bytes: event.data.size,
        type: event.data.type || "(empty)",
        recState: this.rec?.state ?? "gone",
      });
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.rec.onerror = (event) => {
      logVoice("recorder-error", {
        error: String((event as Event & { error?: unknown }).error ?? "unknown"),
      });
    };
    this.rec.start(250);
    logVoice("recorder-start", {
      chosenMime: mime,
      actualMime: this.rec.mimeType,
      recState: this.rec.state,
      streamActive: this.stream.active,
      requestedDevice: requested || "(system default)",
      deviceLabel: this.deviceLabel,
      trackCount: tracks.length,
      liveEnabled: live.length,
      cloned: false,
      analyserConnected: false,
    });
  }

  stop() {
    const rec = this.rec;
    const stream = this.stream;
    const deviceLabel = this.deviceLabel;
    return new Promise<{ blob: Blob; deviceLabel: string }>((resolve, reject) => {
      const finish = () => {
        const tracks = stream?.getAudioTracks() ?? [];
        for (const track of tracks) {
          logVoice("track at stop", describeTrack(track));
        }
        const blob = new Blob(this.chunks, { type: rec?.mimeType || WEBM_TYPE });
        logVoice("recorder-stop", {
          bytes: blob.size,
          type: blob.type,
          chunks: this.chunkIndex,
          ms: Math.round(performance.now() - this.startedAt),
          deviceLabel,
        });
        this.rec = null;
        this.chunks = [];
        this.release();
        resolve({ blob, deviceLabel });
      };
      if (!rec || rec.state === "inactive") {
        finish();
        return;
      }
      rec.onstop = finish;
      rec.onerror = () => reject(new Error("Record failed."));
      rec.stop();
    });
  }

  release() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}

export class PcmStreamPlayer {
  readonly analyser: AnalyserNode;
  private readonly ctx: AudioContext;
  private readonly gain: GainNode;
  private leftover = new Uint8Array(0);
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.gain = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.32;
    this.gain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  async play(response: Response) {
    if (!response.body) throw new Error("No audio stream.");
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.stop();
    this.nextTime = this.ctx.currentTime + 0.04;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) this.enqueue(new Uint8Array(value));
      }
      this.flush();
    } catch (error) {
      this.stop();
      throw error;
    }
    const remaining = this.nextTime - this.ctx.currentTime;
    if (remaining > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, remaining * 1000));
    }
  }

  stop() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.leftover = new Uint8Array(0);
    this.nextTime = this.ctx.currentTime;
  }

  private enqueue(chunk: Uint8Array) {
    const merged = new Uint8Array(this.leftover.length + chunk.byteLength);
    merged.set(this.leftover);
    merged.set(chunk, this.leftover.length);
    const even = merged.byteLength & ~1;
    if (even === 0) {
      this.leftover = merged;
      return;
    }
    this.schedule(copyInt16(merged.subarray(0, even)));
    this.leftover = merged.subarray(even);
  }

  private flush() {
    if (this.leftover.byteLength >= 2) {
      const even = this.leftover.byteLength & ~1;
      this.schedule(copyInt16(this.leftover.subarray(0, even)));
    }
    this.leftover = new Uint8Array(0);
  }

  private schedule(samples: Int16Array) {
    if (samples.length === 0) return;
    const floats = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) {
      floats[i] = samples[i] / 32768;
    }
    const buffer = this.ctx.createBuffer(1, floats.length, TTS_PCM_RATE);
    buffer.copyToChannel(floats, 0);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    const startAt = Math.max(this.ctx.currentTime + 0.02, this.nextTime);
    source.start(startAt);
    this.nextTime = startAt + buffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }
}

function copyInt16(bytes: Uint8Array) {
  const aligned = new Uint8Array(bytes.byteLength);
  aligned.set(bytes);
  return new Int16Array(aligned.buffer);
}

export type HudVoiceIo = {
  ctx: AudioContext;
  recorder: MicRecorder;
  player: PcmStreamPlayer;
};

export function createHudVoiceIo(): HudVoiceIo {
  const ctx = createHudAudioContext();
  return {
    ctx,
    recorder: new MicRecorder(ctx),
    player: new PcmStreamPlayer(ctx),
  };
}
