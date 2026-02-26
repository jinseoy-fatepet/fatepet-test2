import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ReadingPayload = {
  name?: string;
  birthdate?: string;
  birthtime?: string;
  gender?: string;
  breed?: string;
};

type ReadingRow = {
  id: string;
  pet_name: string;
  breed?: string;
  birthdate: string;
  birthtime: string;
  gender: string;
  preview_text: string;
  full_text: string;
  image_url: string;
  is_paid: boolean;
  created_at: string;
};

type GenerationInput = {
  pet_name: string;
  breed: string;
  birthdate: string;
  birthtime: string;
  gender: string;
};

type GenerationOutput = {
  preview_text: string;
  full_text: string;
  image_prompt: string;
};

const SECTION_MIN = 180;
const SECTION_MAX = 300;
const SECTION_TITLES = [
  "타고난 본질",
  "성격 구조",
  "감정 반응",
  "보호자와의 인연",
  "사회성",
  "삶의 흐름",
  "강점",
  "약점",
  "안정감 형성 요소",
  "종합 결론",
] as const;

const SECTION_ENDINGS = ["합니다", "보입니다", "형성됩니다", "작용합니다", "경향이 있습니다", "특성이 나타납니다"] as const;
const IMAGE_MODELS = ["gpt-image-1", "stable-diffusion-xl"] as const;
type ImageModel = (typeof IMAGE_MODELS)[number];

const REQUIRED_TERMS = [
  "일간",
  "오행",
  "수(水)",
  "금(金)",
  "목(木)",
  "화(火)",
  "토(土)",
  "식신",
  "재성",
  "관성",
  "인성",
  "편관",
  "정관",
  "도화살",
  "기운",
  "균형",
  "구조",
];

const HEALTH_TERMS = ["피부", "관절", "소화기", "호흡기", "스트레스", "면역력"];

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getSupabase() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function collapseSpace(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractJsonObject(text: string) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  try {
    return JSON.parse(clean);
  } catch (_e) {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start < 0 || end < 0 || end <= start) return null;
    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch (_e2) {
      return null;
    }
  }
}

function ensureContainsMinTerms(text: string, minTerms: number) {
  let output = text;
  const used = REQUIRED_TERMS.filter((term) => output.includes(term));
  if (used.length >= minTerms) return output;

  const needed = REQUIRED_TERMS.filter((term) => !output.includes(term)).slice(0, minTerms - used.length);
  if (needed.length > 0) {
    output = `${output} ${needed.join(", ")}의 구조와 균형이 아이의 기운을 세밀하게 조절합니다.`;
  }
  return output;
}

function ensureContainsHealth(text: string) {
  const hasHealth = HEALTH_TERMS.some((term) => text.includes(term));
  if (hasHealth) return text;
  return `${text} 특히 스트레스와 소화기 리듬을 함께 관리하면 전체 균형이 더 안정됩니다.`;
}


function normalizePreview(input: string) {
  const cleaned = collapseSpace(input || "");
  if (!cleaned) throw new Error("preview_text is missing from AI generation");
  return cleaned;
}

function applySectionEnding(text: string, index: number) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (SECTION_ENDINGS.some((ending) => trimmed.endsWith(ending))) {
    return trimmed;
  }
  const ending = SECTION_ENDINGS[index % SECTION_ENDINGS.length];
  return `${trimmed} ${ending}`;
}

function normalizeSectionBody(body: string, opts?: { health?: boolean }, index?: number) {
  let out = collapseSpace(body);
  out = ensureContainsMinTerms(out, 2);
  if (opts?.health) out = ensureContainsHealth(out);
  if (out.length > SECTION_MAX) out = out.slice(0, SECTION_MAX).trim();
  if (out.length < SECTION_MIN) {
    out = `${out} 기운의 흐름을 지키며 감정의 기초를 다져두면 균형이 한층 더 안정됩니다.`;
    if (out.length > SECTION_MAX) {
      out = out.slice(0, SECTION_MAX).trim();
    }
  }
  if (typeof index === "number") {
    out = applySectionEnding(out, index);
  }
  return out;
}

function parseSections(fullText: string) {
  const normalized = fullText.replace(/\r/g, "");
  const titlesPattern = SECTION_TITLES.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const blocks = normalized
    .split(new RegExp(`(?=^\\s*(?:\\d+[.)]\\s*)?(?:${titlesPattern})\\s*$)`, "m"))
    .map((b) => b.trim())
    .filter(Boolean);

  const sectionMap = new Map<string, string>();
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const titleLine = lines[0].replace(/^\d+[.)]\s*/, "").trim();
    const body = lines.slice(1).join(" ").trim();
    if (SECTION_TITLES.includes(titleLine as (typeof SECTION_TITLES)[number])) {
      sectionMap.set(titleLine, body);
    }
  }

  return sectionMap;
}

function chunkText(text: string, count: number) {
  const clean = collapseSpace(text);
  const len = Math.max(1, Math.floor(clean.length / count));
  const chunks: string[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const part = clean.slice(cursor, cursor + len + 40);
    chunks.push(part);
    cursor += len;
  }
  return chunks;
}

function normalizeFull(fullText: string) {
  const sectionMap = parseSections(fullText);
  const rawChunks = chunkText(fullText, SECTION_TITLES.length);

  const sections = SECTION_TITLES.map((title, idx) => {
    const source = sectionMap.get(title) || rawChunks[idx] || fullText;
    const body = normalizeSectionBody(source, { health: idx === 7 }, idx);
    return `${idx + 1}. ${title}\n${body}`;
  });

  return sections.join("\n\n");
}

function buildImagePrompt(input: GenerationInput) {
  return `${input.breed}, centered portrait, solo dog, korean saju destiny theme, mystical aura, soft glowing light, elegant composition, ultra detailed, photorealistic, studio lighting, sharp focus, 4k, no text, no watermark, no border`;
}


function buildMasterPrompt(input: GenerationInput) {
  return `당신은 반려견 사주명리학 전문가이며 정교한 리포트를 생성하는 시스템입니다.

입력된 반려견 정보를 바탕으로 꼭 아래 3가지를 각각 독립적으로 생성하십시오:
1. preview_text (전체 흐름 요약)
2. full_text (10개 섹션 구조)
3. image_prompt (사주 리포트 이미지 프롬프트)

------------------------------------------------
[절대 규칙]
preview_text, full_text, image_prompt는 서로 독립적으로 생성해야 합니다.
preview_text는 full_text 가운데 첫 문단이나 문장을 절대 복사하지 말고, 전체 사주를 다시 분석한 새로운 요약이어야 합니다.
다른 문장 구조와 어휘를 사용하여 preview_text와 full_text를 완전히 구분하십시오.
한국어 문법은 자연스럽게, 반복 표현과 번역체를 피하고, "~입니다" 종결만 반복하지 마십시오.

------------------------------------------------
[preview_text 생성 규칙]
목표: 전체 사주를 450~600자 내에서 요약한 한 문단
- 전체 성격, 에너지 흐름, 운세의 변화 축을 꼭 담습니다.
- full_text의 어떤 문장도 그대로 복사하지 마십시오.
- 문장 끝 표현을 다양하게 사용하며 "~입니다"만 지속 사용하지 마십시오 (예: "~합니다", "~보입니다", "~경향이 있습니다" 등).
- 자연스럽고 품질 높은 한국어로 서술하며, 반복된 구조나 동일 어휘를 피하십시오.
- 일간, 오행, 기운, 균형 등 사주 용어 중 네 가지 이상을 포함하고, 보호자 교감, 건강, 삶의 흐름을 함께 담습니다.

------------------------------------------------
[full_text 생성 규칙]
다음 10개 섹션을 반드시 순서대로 작성하십시오:
1. 타고난 본질
2. 성격 구조
3. 감정 반응
4. 보호자와의 인연
5. 사회성
6. 삶의 흐름
7. 강점
8. 약점
9. 안정감 형성 요소
10. 종합 결론

각 섹션은:
- 180자 이상 300자 이하
- 최소 두 개의 사주 용어(예: 일간, 오행, 기운, 균형, 식신, 재성, 관성, 인성, 도화살, 구조)를 포함
- 문장 끝을 "합니다", "보입니다", "형성됩니다", "작용합니다", "경향이 있습니다", "특성이 나타납니다" 중 하나로 다양하게 마무리하고, 같은 종결을 반복하지 않음
- 반복 문장 구조를 피하고, "~입니다"만 의존하지 않으며, 표현을 다양화
- 9번 섹션은 보호자의 루틴과 건강 루틴을 연결해 안정감을 강조
- 전체적으로 피부, 관절, 소화기, 면역력, 호흡기 중 최소 하나 이상의 건강 주제를 언급합니다.

------------------------------------------------
[image_prompt 생성 규칙]
다음 영어 문자열을 그대로 사용하십시오:
"${input.breed}, centered portrait, solo dog, korean saju destiny theme, mystical aura, soft glowing light, elegant composition, ultra detailed, photorealistic, studio lighting, sharp focus, 4k, no text, no watermark, no border"
한 마리의 개만, 중앙에 배치하고 얼굴, 상반신이 선명하게 드러나도록 유지하십시오. 워터마크/텍스트/프레임/기호가 개를 가리지 않아야 합니다.

------------------------------------------------
[입력 데이터]
이름: ${input.pet_name}
견종: ${input.breed}
생년월일: ${input.birthdate}
출생시간: ${input.birthtime}
성별: ${input.gender}

------------------------------------------------
[출력 형식]
반드시 아래 JSON 형식으로만 출력하십시오:
{
  "preview_text": "...",
  "full_text": "...",
  "image_prompt": "..."
}
`;
}


async function generateWithGemini(prompt: string) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4200, temperature: 0.8 },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || "Gemini generation failed");
  }
  return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

async function generateWithOpenAI(prompt: string) {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 3200,
      temperature: 0.8,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI generation failed");

  const textFromOutputArray = Array.isArray(data?.output)
    ? data.output
        .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
        .map((part: any) => String(part?.text || part?.output_text || ""))
        .join("")
    : "";

  return String(data?.output_text || textFromOutputArray || "").trim();
}

async function generateReadingContent(input: GenerationInput): Promise<GenerationOutput> {
  const prompt = buildMasterPrompt(input);
  let raw = "";

  try {
    raw = await generateWithGemini(prompt);
  } catch (geminiError: any) {
    const msg = String(geminiError?.message || "");
    const quotaLike =
      msg.includes("Quota exceeded") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate-limits");
    if (!quotaLike && !process.env.OPENAI_API_KEY) throw geminiError;
    raw = await generateWithOpenAI(prompt);
  }

  const parsed = extractJsonObject(raw) as Partial<GenerationOutput> | null;
  const rawFull = String(parsed?.full_text || raw || "");
  if (!rawFull.trim()) throw new Error("full_text is missing from AI generation");
  const full_text = normalizeFull(rawFull);
  const previewSource = String(parsed?.preview_text || "").trim();
  if (!previewSource) throw new Error("preview_text is missing from AI generation");
  const preview_text = normalizePreview(previewSource);
  const image_prompt = buildImagePrompt(input);

  return { preview_text, full_text, image_prompt };
}


async function generateDogImageBuffer(prompt: string) {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = getImageModel();
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Image generation failed");
  }
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation result missing payload");
  return Buffer.from(b64, "base64");
}

function getImageModel(): ImageModel {
  const candidate = (process.env.FATEPET_IMAGE_MODEL || "").trim();
  if (candidate && IMAGE_MODELS.includes(candidate as ImageModel)) {
    return candidate as ImageModel;
  }
  return IMAGE_MODELS[0];
}

async function uploadReadingImage(args: {
  supabase: ReturnType<typeof getSupabase>;
  readingId: string;
  petName: string;
  birthdate?: string;
  birthtime?: string;
  gender?: string;
  breed?: string;
  image_prompt: string;
}) {
  const bucket = process.env.SUPABASE_READING_BUCKET || "reading-images";
  const buffer = await generateDogImageBuffer(args.image_prompt);
  const filePath = `${args.readingId}/report.png`;

  const { error: uploadError } = await args.supabase.storage
    .from(bucket)
    .upload(filePath, buffer, { contentType: "image/png", upsert: true });

  if (uploadError) throw new Error(`storage upload failed: ${uploadError.message}`);

  const { data } = args.supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase.from("readings").select("*").eq("id", id).single<ReadingRow>();

    if (error || !data) return NextResponse.json({ error: "reading not found" }, { status: 404 });

    return NextResponse.json({
      id: data.id,
      preview: data.preview_text,
      full: data.full_text,
      image_url: data.image_url,
      is_paid: data.is_paid,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReadingPayload;
    const pet_name = String(body.name || "").trim();
    const birthdate = String(body.birthdate || "").trim();
    const birthtime = String(body.birthtime || "").trim();
    const gender = String(body.gender || "").trim();
    const breed = String(body.breed || "").trim();

    if (!pet_name || !birthdate || !birthtime || !gender || !breed) {
      return NextResponse.json(
        { error: "name, birthdate, birthtime, gender, breed are required" },
        { status: 400 }
      );
    }

    const generated = await generateReadingContent({
      pet_name,
      birthdate,
      birthtime,
      gender,
      breed,
    });

    const supabase = getSupabase();

    const { data: inserted, error: insertError } = await supabase
      .from("readings")
      .insert({
        pet_name,
        breed,
        birthdate,
        birthtime,
        gender,
        preview_text: generated.preview_text,
        full_text: generated.full_text,
        image_url: "",
        is_paid: false,
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message || "failed to insert reading");
    }

    const imageUrl = await uploadReadingImage({
      supabase,
      readingId: inserted.id,
      petName: pet_name,
      birthdate,
      birthtime,
      gender,
      breed,
      image_prompt: generated.image_prompt,
    });

    const { error } = await supabase
      .from("readings")
      .update({ image_url: imageUrl })
      .eq("id", inserted.id);

    if (error) {
      console.error(error);
    }

    return NextResponse.json({
      id: inserted.id,
      preview: generated.preview_text,
      full: generated.full_text,
      image_prompt: generated.image_prompt,
      image_url: imageUrl,
      is_paid: false,
    });
  } catch (error: any) {
    console.error("reading route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
