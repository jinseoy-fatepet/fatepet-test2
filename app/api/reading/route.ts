import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
  birthdate: string;
  birthtime: string;
  gender: string;
  preview_text: string;
  full_text: string;
  image_url: string;
  is_paid: boolean;
  created_at: string;
};

const MIN_FULL_LENGTH = 2000;
const PREVIEW_LENGTH = 400;
const SECTION_TARGET_MIN = 450;
const SECTION_TARGET_MAX = 550;

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

function formatPreview(raw: string) {
  const sliced = raw.slice(0, PREVIEW_LENGTH).trim().replace(/\n{3,}/g, "\n\n");
  const parts = sliced
    .split(/(?<=[.!?。]|다\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 2) return sliced;

  const grouped: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    grouped.push(parts.slice(i, i + 2).join(" "));
  }
  return grouped.join("\n\n");
}

function ensurePreviewTeaser(preview: string, full: string) {
  let out = formatPreview(preview || "");
  if (out.length > PREVIEW_LENGTH) out = out.slice(0, PREVIEW_LENGTH).trim();
  if (out.length >= 260) return out;

  const fallback = formatPreview(full);
  if (fallback.length >= 260) {
    return fallback.slice(0, PREVIEW_LENGTH).trim();
  }

  let extended = `${out}\n\n${fallback}`.trim();
  if (extended.length > PREVIEW_LENGTH) extended = extended.slice(0, PREVIEW_LENGTH);
  return extended;
}

function trimToSentence(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const idx = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"), cut.lastIndexOf("다."));
  if (idx > maxLength * 0.65) return cut.slice(0, idx + 1).trim();
  return cut.trim();
}

function normalizeFullSections(full: string) {
  const blocks = full
    .split(/(?=^\d+\)\s.*$)/m)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length < 2) return full;

  const normalized = blocks.map((block) => {
    const lines = block.split("\n");
    const heading = lines[0].trim();
    let body = lines.slice(1).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    body = body.replace(/[ \t]{2,}/g, " ");

    if (body.length > SECTION_TARGET_MAX) {
      body = trimToSentence(body, SECTION_TARGET_MAX);
    }
    if (body.length < SECTION_TARGET_MIN) {
      const filler =
        " 보호자는 일관된 루틴과 다정한 반응을 유지하면 아이의 기운이 안정되고, 관계 만족도와 생활 리듬이 함께 상승합니다.";
      while (body.length < SECTION_TARGET_MIN) body = `${body}${filler}`;
      body = trimToSentence(body, SECTION_TARGET_MAX);
    }
    return `${heading}\n${body}`;
  });

  return normalized.join("\n\n");
}

function chunkTextBySize(text: string, chunkSize: number, count: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let offset = 0;
  for (let i = 0; i < count; i += 1) {
    if (offset >= clean.length) {
      chunks.push("");
      continue;
    }
    const next = clean.slice(offset, offset + chunkSize);
    const cutPoint = Math.max(
      next.lastIndexOf("."),
      next.lastIndexOf("!"),
      next.lastIndexOf("?"),
      next.lastIndexOf("다.")
    );
    const piece =
      cutPoint > chunkSize * 0.65 ? next.slice(0, cutPoint + 1).trim() : next.trim();
    chunks.push(piece);
    offset += Math.max(piece.length, Math.floor(chunkSize * 0.8));
  }
  return chunks;
}

function enforceStructuredFull(full: string) {
  const normalized = normalizeFullSections(full);
  const blocks = normalized.split(/(?=^\d+\)\s.*$)/m).filter((b) => b.trim().length > 0);
  if (blocks.length >= 4) return normalized;

  const sections = [
    "1) Personality",
    "2) Relationship with owner",
    "3) 오행·십성 분석",
    "4) 행동·놀이·색상 가이드",
  ];
  const chunks = chunkTextBySize(full, 520, sections.length);
  const rebuilt = sections
    .map((title, i) => `${title}\n${trimToSentence(chunks[i] || full, SECTION_TARGET_MAX)}`)
    .join("\n\n");
  return rebuilt;
}

async function generateFullReadingWithGemini(input: {
  name: string;
  birthdate: string;
  birthtime: string;
  gender: string;
  breed?: string;
}) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const prompt = `
너는 20~40대 여성 보호자에게 깊은 공감과 위로를 주는 반려동물 사주 전문 해설가다.
아래 입력으로 "전체 사주 리포트"를 한국어로 작성해라.

입력:
- 이름: ${input.name}
- 생년월일: ${input.birthdate}
- 생시: ${input.birthtime}
- 성별: ${input.gender}
- 견종: ${input.breed || "정보없음"}

중요 작성 원칙:
- 해석 비중은 이름/생년월일/생시 기반 70%, 견종 특성 기반 30%를 반영하되 이 비중 규칙은 본문에 절대 노출하지 않는다.
- 문체는 감성적이면서도 전문적이어야 하며, 보호자가 "내가 잘하고 있다"는 안도감을 느끼게 한다.
- 사주 용어를 자연스럽게 적극 사용: 임수, 계수, 경금, 신금, 도화살, 오행, 일간, 용신, 대운, 십성 등.
- 과장, 공포 조장, 단정적 질병 예언 금지.
- 인간이 아닌 반려동물(강아지) 관점으로 해석하고, 행동/습관/교감 중심으로 설명한다.

반드시 아래 섹션 순서와 제목을 정확히 지켜 작성:
1) Personality
2) Strength
3) Weakness
4) Relationship with owner
5) Life flow
6) Advice
7) 오행분석
8) 십성분포
9) 십성해석
10) 이름분석
11) 사주요약
12) 어울리는 색
13) 피해야 할 색
14) 보호자가 해야 할 행동
15) 추천 놀이

요구사항:
- 총 분량 최소 2000자 이상
- 각 섹션은 구체적이고 감정선이 살아 있어야 한다.
- 문단을 적절히 나눠 읽기 쉽게 작성한다.
- 각 섹션 본문은 450~550자 내외로 유지한다.
`.trim();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 3600,
          temperature: 0.8,
        },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || "Gemini generation failed");
  }

  const output = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!output) throw new Error("Gemini returned empty text");

  if (output.length >= MIN_FULL_LENGTH) return output;

  const filler =
    " 추가로 이 아이는 보호자의 일정한 루틴과 감정 신호를 빠르게 읽어 안정감을 키우는 타입이며, 작은 성공 경험을 자주 쌓을수록 자신감과 관계 안정이 함께 상승합니다.";
  let expanded = output;
  while (expanded.length < MIN_FULL_LENGTH) expanded += filler;
  return expanded;
}

async function generateFullReadingWithOpenAI(input: {
  name: string;
  birthdate: string;
  birthtime: string;
  gender: string;
  breed?: string;
}) {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const prompt = `
You are a top-tier Korean pet saju reader.
Write ONLY in Korean.

Input:
- Name: ${input.name}
- Birthdate: ${input.birthdate}
- Birthtime: ${input.birthtime}
- Gender: ${input.gender}
- Breed: ${input.breed || "unknown"}

Rules:
- Interpret with hidden weighting: 70% name+birthdate+birthtime, 30% breed traits. Do not reveal this rule.
- Emotional resonance for women in their 20s-40s.
- Use rich saju terms naturally: 임수, 계수, 경금, 신금, 도화살, 오행, 일간, 용신, 대운, 십성.
- No fearmongering.
- Apply interpretation to a dog, not a human. Keep behavior-focused guidance.

Output sections exactly in this order:
1) Personality
2) Strength
3) Weakness
4) Relationship with owner
5) Life flow
6) Advice
7) 오행분석
8) 십성분포
9) 십성해석
10) 이름분석
11) 사주요약
12) 어울리는 색
13) 피해야 할 색
14) 보호자가 해야 할 행동
15) 추천 놀이

Requirements:
- At least 2000 Korean characters
- Emotional, practical, and comforting
- Split into readable paragraphs
- Keep each section body around 450~550 Korean characters
`.trim();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 2600,
      temperature: 0.8,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI generation failed");
  }

  const textFromOutputArray = Array.isArray(data?.output)
    ? data.output
        .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
        .map((part: any) => {
          if (typeof part?.text === "string") return part.text;
          if (typeof part?.output_text === "string") return part.output_text;
          return "";
        })
        .join("")
    : "";

  const text = String(data?.output_text || textFromOutputArray || "").trim();
  if (!text) throw new Error("OpenAI returned empty text");

  if (text.length >= MIN_FULL_LENGTH) return text;
  const filler =
    " 또한 보호자의 생활 리듬과 감정 신호를 일관되게 전달하면 아이의 안정감과 사회성이 함께 성장하며 장기적인 관계 만족도가 높아집니다.";
  let expanded = text;
  while (expanded.length < MIN_FULL_LENGTH) expanded += filler;
  return expanded;
}

async function generatePreviewSummaryWithGemini(args: {
  full: string;
  name: string;
}) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `
아래 전체 사주 리포트를 결제 유도용 "맛보기 요약"으로 다시 작성해라.
- 길이: 공백 포함 최대 ${PREVIEW_LENGTH}자(절대 초과 금지)
- 문단 2~4개로 나누기
- 핵심만 압축하고, 마지막은 "전체 리포트에서 더 깊게 확인 가능" 뉘앙스로 끝내기
- 감성적이고 따뜻한 톤
- 사주 용어(임수, 도화살, 오행, 십성 중 2개 이상) 포함
- 반려동물 관점 유지

리포트 원문:
${args.full}
`.trim();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.8 },
      }),
    }
  );
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data?.error?.message || "Gemini preview failed");
  return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

async function generatePreviewSummaryWithOpenAI(args: { full: string; name: string }) {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const prompt = `
다음 전체 리포트를 결제 유도용 프리뷰로 요약해 주세요.
- 최대 ${PREVIEW_LENGTH}자(초과 금지)
- 2~4문단
- 감성적, 공감형, 따뜻한 톤
- 사주 용어 최소 2개 포함(예: 임수, 도화살, 오행, 십성)
- 마지막 문단은 전체 리포트에서 더 깊게 볼 수 있다는 여운
- 동물 해석 관점 유지

원문:
${args.full}
`.trim();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 500,
      temperature: 0.8,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI preview failed");
  const textFromOutputArray = Array.isArray(data?.output)
    ? data.output
        .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
        .map((part: any) => String(part?.text || part?.output_text || ""))
        .join("")
    : "";
  return String(data?.output_text || textFromOutputArray || "").trim();
}

async function generatePreviewSummary(args: {
  full: string;
  name: string;
}) {
  try {
    const gem = await generatePreviewSummaryWithGemini(args);
    if (gem) return ensurePreviewTeaser(gem, args.full);
  } catch (_e) {}

  try {
    const oa = await generatePreviewSummaryWithOpenAI(args);
    if (oa) return ensurePreviewTeaser(oa, args.full);
  } catch (_e) {}

  return ensurePreviewTeaser(args.full, args.full);
}

async function buildReadingImageSvg(input: {
  petName: string;
  birthdate?: string;
  birthtime?: string;
  gender?: string;
  breed?: string;
}) {
  const dogPath = path.join(process.cwd(), "public", "default-dog.svg");
  const dogSvgRaw = await readFile(dogPath, "utf8");
  const dogSvgBase64 = Buffer.from(dogSvgRaw, "utf8").toString("base64");
  const seed = `${input.petName}|${input.birthdate || ""}|${input.birthtime || ""}|${input.gender || ""}|${input.breed || ""}`;
  const tone = seed.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 3;
  const palettes = [
    ["#ece0cb", "#cab086", "#7f5f35"],
    ["#e7ddce", "#bfa785", "#6b5236"],
    ["#efe5d2", "#c3ab80", "#7d6646"],
  ] as const;
  const [paper, line, accent] = palettes[tone];

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#241a12"/>
      <stop offset="100%" stop-color="#3f2c18"/>
    </linearGradient>
    <pattern id="hanji" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M0 0h24v24H0z" fill="none"/>
      <circle cx="2" cy="2" r="1" fill="#ffffff22"/>
      <circle cx="18" cy="12" r="1" fill="#ffffff18"/>
      <circle cx="10" cy="20" r="1" fill="#ffffff20"/>
    </pattern>
    <radialGradient id="shine" cx="0.5" cy="0.5" r="0.6">
      <stop offset="0%" stop-color="#fff9ef" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#f0dabb" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1536" fill="url(#bg)"/>
  <rect x="34" y="34" width="956" height="1468" rx="30" fill="#11111166" stroke="${line}" stroke-width="5"/>
  <rect x="54" y="54" width="916" height="1428" rx="24" fill="${paper}" stroke="${line}" stroke-width="3"/>
  <rect x="54" y="54" width="916" height="1428" rx="24" fill="url(#hanji)"/>

  <rect x="88" y="104" width="536" height="520" rx="22" fill="#f9f2e4" stroke="${line}" stroke-width="3"/>
  <rect x="114" y="142" width="486" height="130" rx="16" fill="#fffaf1" stroke="${line}" stroke-width="2"/>
  <rect x="114" y="292" width="486" height="304" rx="16" fill="#fffdf8" stroke="${line}" stroke-width="2"/>
  <line x1="114" y1="392" x2="600" y2="392" stroke="#b5966d" stroke-width="1.5"/>
  <line x1="114" y1="492" x2="600" y2="492" stroke="#b5966d" stroke-width="1.5"/>
  <line x1="236" y1="292" x2="236" y2="596" stroke="#b5966d" stroke-width="1.5"/>
  <line x1="358" y1="292" x2="358" y2="596" stroke="#b5966d" stroke-width="1.5"/>
  <line x1="480" y1="292" x2="480" y2="596" stroke="#b5966d" stroke-width="1.5"/>

  <circle cx="760" cy="320" r="194" fill="#efe3cd" stroke="${accent}" stroke-width="6"/>
  <circle cx="760" cy="320" r="136" fill="#fff5e4" stroke="${line}" stroke-width="5"/>
  <image href="data:image/svg+xml;base64,${dogSvgBase64}" x="396" y="246" width="232" height="232"/>
  <image href="data:image/svg+xml;base64,${dogSvgBase64}" x="624" y="184" width="272" height="272"/>
  <circle cx="760" cy="320" r="184" fill="url(#shine)"/>

  <g transform="translate(654 548)">
    <rect x="0" y="0" width="212" height="84" rx="14" fill="#fdf8ef" stroke="${line}" stroke-width="2"/>
    <circle cx="34" cy="42" r="14" fill="#79a9d8"/>
    <circle cx="74" cy="42" r="14" fill="#89b07a"/>
    <circle cx="114" cy="42" r="14" fill="#e09d54"/>
    <circle cx="154" cy="42" r="14" fill="#a98f72"/>
    <circle cx="194" cy="42" r="10" fill="#c25e5e"/>
  </g>

  <g transform="translate(88 668)" stroke="${accent}" stroke-width="8" stroke-linecap="round">
    <line x1="0" y1="0" x2="110" y2="0"/>
    <line x1="0" y1="28" x2="40" y2="28"/>
    <line x1="70" y1="28" x2="110" y2="28"/>
    <line x1="0" y1="56" x2="110" y2="56"/>
  </g>
  <g transform="translate(826 668)" stroke="${accent}" stroke-width="8" stroke-linecap="round">
    <line x1="0" y1="0" x2="110" y2="0"/>
    <line x1="0" y1="28" x2="40" y2="28"/>
    <line x1="70" y1="28" x2="110" y2="28"/>
    <line x1="0" y1="56" x2="110" y2="56"/>
  </g>

  <rect x="88" y="760" width="848" height="668" rx="24" fill="#fff7eb" stroke="${line}" stroke-width="3"/>
  <rect x="118" y="806" width="788" height="182" rx="18" fill="#fffdf8" stroke="${line}" stroke-width="2"/>
  <rect x="118" y="1014" width="788" height="182" rx="18" fill="#fffdf8" stroke="${line}" stroke-width="2"/>
  <rect x="118" y="1222" width="788" height="162" rx="18" fill="#fffdf8" stroke="${line}" stroke-width="2"/>

  <g transform="translate(146 848)">
    <circle cx="0" cy="0" r="12" fill="#7aa5cc"/>
    <circle cx="52" cy="0" r="12" fill="#86b07b"/>
    <circle cx="104" cy="0" r="12" fill="#d68f52"/>
    <circle cx="156" cy="0" r="12" fill="#b49776"/>
    <circle cx="208" cy="0" r="12" fill="#b25454"/>
  </g>
  <g transform="translate(146 1060)">
    <path d="M0 0l14 24h-28z" fill="#8d764f"/>
    <path d="M56 0l14 24h-28z" fill="#3b8fc0"/>
    <path d="M112 0l14 24h-28z" fill="#7ea76d"/>
    <path d="M168 0l14 24h-28z" fill="#c86d48"/>
    <path d="M224 0l14 24h-28z" fill="#7a60a8"/>
  </g>
  <g transform="translate(146 1270)" stroke="${accent}" stroke-width="5" stroke-linecap="round">
    <line x1="0" y1="0" x2="220" y2="0"/>
    <line x1="0" y1="26" x2="180" y2="26"/>
    <line x1="0" y1="52" x2="200" y2="52"/>
  </g>
</svg>`.trim();
}

async function uploadReadingImage(args: {
  supabase: ReturnType<typeof getSupabase>;
  readingId: string;
  petName: string;
  birthdate?: string;
  birthtime?: string;
  gender?: string;
  breed?: string;
}) {
  const bucket = process.env.SUPABASE_READING_BUCKET || "reading-images";
  const svg = await buildReadingImageSvg({
    petName: args.petName,
    birthdate: args.birthdate,
    birthtime: args.birthtime,
    gender: args.gender,
    breed: args.breed,
  });
  const filePath = `${args.readingId}/report.svg`;
  const bytes = Buffer.from(svg, "utf8");

  const { error: uploadError } = await args.supabase.storage
    .from(bucket)
    .upload(filePath, bytes, {
      contentType: "image/svg+xml",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`storage upload failed: ${uploadError.message}`);
  }

  const { data } = args.supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("readings")
      .select("*")
      .eq("id", id)
      .single<ReadingRow>();

    if (error || !data) {
      return NextResponse.json({ error: "reading not found" }, { status: 404 });
    }

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
    const petName = body.name?.trim();
    const birthdate = body.birthdate?.trim();
    const birthtime = body.birthtime?.trim();
    const gender = body.gender?.trim();
    const breed = body.breed?.trim();

    if (!petName || !birthdate || !birthtime || !gender) {
      return NextResponse.json(
        { error: "name, birthdate, birthtime, gender are required" },
        { status: 400 }
      );
    }

    let full: string;
    try {
      full = await generateFullReadingWithGemini({
        name: petName,
        birthdate,
        birthtime,
        gender,
        breed,
      });
    } catch (geminiError: any) {
      const message = String(geminiError?.message || "");
      const quotaLike =
        message.includes("Quota exceeded") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("rate-limits");
      if (!quotaLike && !process.env.OPENAI_API_KEY) throw geminiError;

      full = await generateFullReadingWithOpenAI({
        name: petName,
        birthdate,
        birthtime,
        gender,
        breed,
      });
    }
    full = enforceStructuredFull(full);
    const preview = await generatePreviewSummary({ full, name: petName });
    const supabase = getSupabase();

    const { data: inserted, error: insertError } = await supabase
      .from("readings")
      .insert({
        pet_name: petName,
        birthdate,
        birthtime,
        gender,
        preview_text: preview,
        full_text: full,
        image_url: "",
        is_paid: false,
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message || "failed to insert reading");
    }

    const imageUrl = await uploadReadingImage({
      supabase,
      readingId: inserted.id,
      petName,
      birthdate,
      birthtime,
      gender,
      breed,
    });

    const { error: updateError } = await supabase
      .from("readings")
      .update({ image_url: imageUrl })
      .eq("id", inserted.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      id: inserted.id,
      preview,
      full,
      image_url: imageUrl,
      is_paid: false,
    });
  } catch (error: any) {
    console.error("reading route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
