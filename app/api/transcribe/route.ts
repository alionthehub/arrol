import { isAuthenticated } from "@/lib/session";
import { transcribeAudio } from "@/lib/voice";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "ACCESS DENIED" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected audio form data." }, { status: 400 });
  }

  const upload = asWebmFile(form.get("audio"));
  if (!upload) {
    return Response.json({ error: "No audio received." }, { status: 400 });
  }

  console.info("[arrol-voice] /api/transcribe", {
    name: upload.name,
    bytes: upload.size,
    mimeType: upload.type,
  });

  try {
    const text = await transcribeAudio(upload);
    return Response.json({ text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transcribe failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}

function asWebmFile(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof Blob) || value.size === 0) return null;
  return new File([value], "speech.webm", { type: "audio/webm" });
}
