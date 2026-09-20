export type MicChoice = {
  deviceId: string;
  label: string;
};

export type MicInput = {
  deviceId: string;
  label: string;
};

const STORAGE_KEY = "arrol.microphone";
export const EMPTY_RECORDING_BYTES = 800;
export const SILENT_PEAK = 0.012;

const EMPTY_CHOICE: MicChoice = { deviceId: "", label: "" };

export function loadMicChoice(): MicChoice {
  if (typeof window === "undefined") return EMPTY_CHOICE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CHOICE;
    const parsed = JSON.parse(raw) as Partial<MicChoice>;
    return {
      deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId : "",
      label: typeof parsed.label === "string" ? parsed.label : "",
    };
  } catch {
    return EMPTY_CHOICE;
  }
}

export function saveMicChoice(choice: MicChoice) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
}

export function micConstraints(deviceId: string): MediaStreamConstraints {
  if (!deviceId) return { audio: true };
  return { audio: { deviceId: { exact: deviceId } } };
}

export function micDisplayName(...names: Array<string | undefined>) {
  for (const name of names) {
    const trimmed = name?.trim();
    if (trimmed) return trimmed;
  }
  return "microphone";
}

export function noAudioMessage(deviceName: string) {
  return `no audio from ${micDisplayName(deviceName)} — check your microphone`;
}

export function isNearSilent(bytes: number, peak: number | null) {
  if (bytes < EMPTY_RECORDING_BYTES) return true;
  return peak !== null && peak < SILENT_PEAK;
}

export async function unlockMicLabels() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

export async function listMicInputs(): Promise<MicInput[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "audioinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label.trim() || `Microphone ${index + 1}`,
    }));
}

export async function recordingPeak(blob: Blob): Promise<number | null> {
  if (blob.size < 16) return 0;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  try {
    const buffer = await ctx.decodeAudioData(await blob.slice(0).arrayBuffer());
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) {
        const value = Math.abs(data[i]);
        if (value > peak) peak = value;
      }
    }
    return peak;
  } catch {
    return null;
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
