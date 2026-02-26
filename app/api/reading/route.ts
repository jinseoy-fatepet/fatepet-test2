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

const PREVIEW_MIN = 500;
const PREVIEW_MAX = 600;
const SECTION_MIN = 200;
const SECTION_MAX = 300;
const SECTION_TITLES = [
  "사주 원국 구조 분석",
  "일간 중심 성향 분석",
  "오행 균형 및 에너지 흐름",
  "성격 및 행동 기질",
  "지능 및 학습 능력",
  "보호자와의 인연 및 교감",
  "사회성 및 외부 관계",
  "건강 및 질병 운",
  "인생 흐름 및 전환점",
  "종합 결론",
] as const;

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

function buildPreviewFallback(input: GenerationInput) {
  return `${input.pet_name}의 사주 흐름은 일간의 안정성과 오행의 균형을 중심으로 읽히며, ${input.breed} 기질이 더해져 수(水)와 금(金)의 기운이 관계 감수성을 세밀하게 살립니다. 평소 표현에서는 식신과 인성 구조가 부드럽게 작동해 보호자와의 교감 신호를 빠르게 읽고, 도화살 작용은 낯선 환경에서도 호기심을 잃지 않게 돕습니다. 다만 관성 압력이 강해지는 날에는 긴장 반응이 피부와 소화기 컨디션으로 드러날 수 있어 휴식 리듬이 중요합니다. 전 생애 흐름은 초기 적응기, 성숙기, 안정기로 갈수록 기운 정렬이 또렷해지며 보호자의 일관된 루틴이 아이의 균형을 장기적으로 단단하게 만듭니다.`;
}

function ensurePreviewCoverage(text: string) {
  let out = text;
  if (!out.includes("일간")) out = `${out} 일간의 축이 흔들리지 않아 기본 정서가 안정적입니다.`;
  if (!out.includes("오행")) out = `${out} 오행의 순환은 환경 적응과 관계 해석의 핵심 기준이 됩니다.`;
  if (!out.includes("균형")) out = `${out} 생활 리듬의 균형을 지키면 아이의 기운 흐름이 더 부드러워집니다.`;
  if (!out.includes("보호자")) out = `${out} 보호자와의 상호 반응이 아이의 감정 안정에 직접적 영향을 줍니다.`;
  if (!out.includes("성격")) out = `${out} 성격의 핵심은 다정함과 관찰력이 공존하는 점입니다.`;
  if (!out.includes("인생 흐름")) out = `${out} 인생 흐름은 초기 적응기 이후 성숙 구간에서 완성도가 높아집니다.`;
  return out;
}

function splitToPreviewParagraphs(text: string) {
  const sentences = text
    .split(/(?<=[.!?]|다\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return sentences.join(" ");

  const groups: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    groups.push(sentences.slice(i, i + 2).join(" "));
  }
  return groups.join("\n\n");
}

function normalizePreview(input: string, context: GenerationInput) {
  let text = collapseSpace(input || "");
  if (!text) text = collapseSpace(buildPreviewFallback(context));

  text = ensurePreviewCoverage(text);
  text = ensureContainsMinTerms(text, 4);
  text = ensureContainsHealth(text);

  if (text.length > PREVIEW_MAX) text = text.slice(0, PREVIEW_MAX).trim();
  while (text.length < PREVIEW_MIN) {
    text = `${text} 보호자와의 교감이 깊어질수록 아이의 오행 균형이 더 따뜻하게 안정되고 인생 흐름도 유연해집니다.`;
    if (text.length > PREVIEW_MAX) {
      text = text.slice(0, PREVIEW_MAX).trim();
      break;
    }
  }

  let out = splitToPreviewParagraphs(text);
  if (out.length > PREVIEW_MAX) out = out.slice(0, PREVIEW_MAX).trim();
  if (out.length < PREVIEW_MIN) {
    out = `${out} 오행의 균형을 지켜주는 생활 루틴이 아이의 정서 안정과 건강 관리의 중심축이 됩니다.`;
    if (out.length > PREVIEW_MAX) out = out.slice(0, PREVIEW_MAX).trim();
  }
  return out;
}

function normalizeSectionBody(body: string, opts?: { health?: boolean }) {
  let out = collapseSpace(body);
  out = ensureContainsMinTerms(out, 2);
  if (opts?.health) out = ensureContainsHealth(out);
  if (out.length > SECTION_MAX) out = out.slice(0, SECTION_MAX).trim();
  while (out.length < SECTION_MIN) {
    out = `${out} 일간과 오행의 균형을 기준으로 보호자의 반응 루틴을 일정하게 유지하면 아이의 기운이 안정되고 관계의 구조가 더 단단해집니다.`;
    if (out.length > SECTION_MAX) {
      out = out.slice(0, SECTION_MAX).trim();
      break;
    }
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
    const body = normalizeSectionBody(source, { health: idx === 7 });
    return `${idx + 1}. ${title}\n${body}`;
  });

  return sections.join("\n\n");
}

function buildImagePrompt(input: GenerationInput) {
  return `A realistic ${input.breed} dog with exact breed characteristics visible, centered portrait, full body or upper body visible, looking calm and intelligent, Korean saju fortune report style, premium parchment background, beige Korean traditional paper texture, elegant and minimal layout, clean and professional composition, soft lighting, studio quality, subtle decorative Korean traditional pattern, premium infographic aesthetic, clean background, not distorted, not abstract, not blurry, square format, ultra high quality, sharp details, no text, no letters, no Korean characters, no Chinese characters, no glitch, no broken layout`;
}

function buildMasterPrompt(input: GenerationInput) {
  return `당신은 반려견 사주명리학 전문가이자, 전문 리포트 생성 시스템입니다.

입력된 반려견 정보를 기반으로 반드시 아래 3가지를 각각 독립적으로 생성하십시오:
1. preview_text (맛보기 사주)
2. full_text (전체 사주 풀이)
3. image_prompt (사주 리포트 이미지 생성용 프롬프트)

------------------------------------------------
[절대 규칙]
preview_text, full_text, image_prompt는 서로 독립적으로 생성하십시오.
preview_text는 full_text의 첫 문장, 일부, 요약, 발췌를 절대 사용하지 마십시오.
preview_text는 전체 사주를 다시 분석하여 새롭게 생성한 "전체 요약본"입니다.
preview_text와 full_text는 서로 완전히 다른 문장으로 작성하십시오.

------------------------------------------------
[preview_text 생성 규칙]
목표: 전체 사주에 대한 요약본
- 500자 이상, 600자 이내
- 반드시 전체 사주 구조를 요약해야 함
- full_text의 첫 문단 복사 금지
- 새로운 문장으로 생성

반드시 포함할 내용:
- 일간과 오행 균형
- 성격 핵심
- 보호자와의 관계
- 건강 경향
- 인생 흐름

사주용어 최소 4개 이상 포함:
일간, 오행, 수(水), 금(金), 목(木), 화(火), 토(土),
식신, 재성, 관성, 인성, 도화살, 구조, 기운, 균형

톤:
전문적이고 따뜻한 명리학 리포트 요약

------------------------------------------------
[full_text 생성 규칙]
아래 10개 섹션으로 작성하십시오:
1. 사주 원국 구조 분석
2. 일간 중심 성향 분석
3. 오행 균형 및 에너지 흐름
4. 성격 및 행동 기질
5. 지능 및 학습 능력
6. 보호자와의 인연 및 교감
7. 사회성 및 외부 관계
8. 건강 및 질병 운
9. 인생 흐름 및 전환점
10. 종합 결론

각 섹션은 반드시:
- 최소 200자 이상
- 최대 300자 이내
- 반드시 사주 명리학 용어 최소 2개 이상 포함

사용 가능한 사주 용어:
일간, 오행, 수(水), 금(金), 목(木), 화(火), 토(土),
식신, 상관, 재성, 편재, 정재, 관성, 편관, 정관,
인성, 편인, 정인, 도화살, 천을귀인, 구조, 기운, 균형

톤:
- 전문 명리학 해석 스타일
- 따뜻하고 보호자 중심적 해석
- 실제 사주 리포트 수준

건강 섹션에는 반드시 아래 중 최소 1개 포함:
피부, 관절, 소화기, 면역력, 호흡기

------------------------------------------------
[image_prompt 생성 규칙]
이미지 생성용 프롬프트를 영어로 작성하십시오.

DOG REQUIREMENT:
- A realistic ${input.breed} dog
- exact breed characteristics visible
- centered portrait
- full body or upper body visible
- looking calm and intelligent

STYLE REQUIREMENT:
- Korean saju fortune report style
- premium parchment background
- beige Korean traditional paper texture
- elegant and minimal layout
- clean and professional
- soft lighting
- studio quality
- no text
- no letters
- no Korean characters
- no Chinese characters

LAYOUT REQUIREMENT:
- dog centered
- subtle decorative Korean traditional pattern
- premium infographic aesthetic
- clean background
- not distorted
- not abstract
- not blurry

TECHNICAL REQUIREMENT:
- square format
- ultra high quality
- sharp details
- no glitch
- no broken layout

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

절대로 preview_text를 full_text에서 복사하지 마십시오.
절대로 설명을 추가하지 마십시오.`;
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
  const full_text = normalizeFull(String(parsed?.full_text || raw || ""));
  let preview_text = normalizePreview(String(parsed?.preview_text || ""), input);
  const previewProbe = preview_text.slice(0, 120).trim();
  if (previewProbe && full_text.includes(previewProbe)) {
    preview_text = normalizePreview("", input);
  }
  const image_prompt = buildImagePrompt(input);

  return { preview_text, full_text, image_prompt };
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
    .upload(filePath, bytes, { contentType: "image/svg+xml", upsert: true });

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
      .single<{ id: string }>();

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
    });

    const { error: updateError } = await supabase
      .from("readings")
      .update({ image_url: imageUrl })
      .eq("id", inserted.id);

    if (updateError) throw new Error(updateError.message);

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
