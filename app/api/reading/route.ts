import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

type ReadingPayload = {
  name?: string;
  birthdate?: string;
  birthtime?: string;
  gender?: string;
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

function sanitizeText(raw: string) {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toMultiline(text: string, lineLength = 21, maxLines = 7) {
  const clean = text.replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  for (let i = 0; i < clean.length; i += lineLength) {
    lines.push(clean.slice(i, i + lineLength));
    if (lines.length >= maxLines) break;
  }
  return lines;
}

async function generateFullReadingWithGemini(input: {
  name: string;
  birthdate: string;
  birthtime: string;
  gender: string;
}) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const prompt = `
너는 반려동물 사주 전문 해설가다. 아래 입력으로 반려동물 운세 리포트를 한국어로 작성해라.
입력:
- 이름: ${input.name}
- 생년월일: ${input.birthdate}
- 생시: ${input.birthtime}
- 성별: ${input.gender}

반드시 아래 섹션 순서로 작성:
1) Personality
2) Strength
3) Weakness
4) Relationship with owner
5) Life flow
6) Advice

요구사항:
- 총 분량 최소 2000자 이상
- 각 섹션은 현실적이고 구체적인 설명
- 과장/공포 표현 금지, 따뜻하고 전문적인 톤
- 반드시 한글로 작성
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

async function buildReadingImageSvg(input: {
  petName: string;
  preview: string;
}) {
  const dogPath = path.join(process.cwd(), "public", "default-dog.svg");
  const dogSvgRaw = await readFile(dogPath, "utf8");
  const dogSvgBase64 = Buffer.from(dogSvgRaw, "utf8").toString("base64");
  const previewLines = toMultiline(input.preview, 21, 7);

  const lines = previewLines
    .map(
      (line, idx) =>
        `<tspan x="48" y="${390 + idx * 30}">${sanitizeText(line)}</tspan>`
    )
    .join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f6efe3"/>
      <stop offset="100%" stop-color="#ead9be"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1536" fill="url(#bg)"/>
  <rect x="36" y="36" width="952" height="1464" rx="34" fill="#fff9ee" stroke="#d7c4a2" stroke-width="4"/>
  <text x="52" y="96" font-size="34" font-weight="700" fill="#5f4a2d">FatePet Fortune Reading</text>
  <text x="52" y="146" font-size="46" font-weight="800" fill="#2f2718">${sanitizeText(
    input.petName
  )}</text>
  <circle cx="512" cy="252" r="116" fill="#f8ead5" stroke="#d5bf99" stroke-width="6"/>
  <image href="data:image/svg+xml;base64,${dogSvgBase64}" x="396" y="136" width="232" height="232"/>
  <rect x="40" y="336" width="944" height="270" rx="20" fill="#fffdf8" stroke="#e7dcc8"/>
  <text font-size="29" font-weight="700" fill="#3b2f20">${lines}</text>
  <text x="52" y="665" font-size="28" font-weight="800" fill="#624c2d">Full Reading</text>
  <rect x="40" y="690" width="944" height="760" rx="20" fill="#ffffff" stroke="#e7dcc8"/>
  <text x="52" y="742" font-size="24" fill="#7b6647">결제 전에는 미리보기만 제공됩니다.</text>
  <text x="52" y="786" font-size="24" fill="#7b6647">결제 완료 후 전체 리포트가 열립니다.</text>
</svg>`.trim();
}

async function uploadReadingImage(args: {
  supabase: ReturnType<typeof getSupabase>;
  readingId: string;
  petName: string;
  preview: string;
}) {
  const bucket = process.env.SUPABASE_READING_BUCKET || "reading-images";
  const svg = await buildReadingImageSvg({ petName: args.petName, preview: args.preview });
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

    if (!petName || !birthdate || !birthtime || !gender) {
      return NextResponse.json(
        { error: "name, birthdate, birthtime, gender are required" },
        { status: 400 }
      );
    }

    const full = await generateFullReadingWithGemini({
      name: petName,
      birthdate,
      birthtime,
      gender,
    });
    const preview = full.slice(0, 300);
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
      preview,
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
