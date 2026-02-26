import { NextResponse } from "next/server";

const MIN_PREVIEW_LENGTH = 220;

function normalizeBirthTime(raw: string) {
  if (!raw || raw === "unknown") return "";
  return raw;
}

function normalizeGender(raw: string) {
  if (raw === "male") return "남아";
  if (raw === "female") return "여아";
  return raw || "";
}

function buildPreviewPrompt(
  _name: string,
  _breed: string,
  _birth: string,
  _birthTime: string,
  _gender: string,
  minLength: number,
  attempt: number
) {
  const intensity =
    attempt === 1
      ? "반드시 요구 조건을 모두 지키세요."
      : "이전 응답이 너무 짧았습니다. 길이 조건을 최우선으로 지키세요.";
  return `반려동물 사주 맛보기 해설을 작성하세요.
입력 데이터(이름, 견종, 생년월일, 생시, 성별)는 내부 해석에만 사용하고, 본문에는 절대 직접 쓰지 마세요.
반드시 "보호자님, 아이는"으로 시작하고 문장을 끝까지 완결해 주세요.
결과는 공백 포함 최소 ${minLength}자 이상으로 작성하고, 절대 중간에 끊기지 않게 해 주세요.
해석 비중은 견종 특성 30%, 이름+생년월일(및 시간) 기반 기운 해석 70%로 구성하세요.
견종의 행동 특성(에너지/사회성/훈련 반응)을 반영하고, 이름과 생시 흐름으로 성향·감정·생활 리듬을 섬세하게 풀어 주세요.
사주 용어는 오행, 일간, 월지, 시주, 십성, 용신, 대운 중 3개 이상 자연스럽게 쓰되 특정 단어만 반복하지 마세요.
주요 타겟은 20-40대 여성 보호자이므로, 실제 상담처럼 섬세하고 감성적인 문체로 작성하세요.
죄책감/불안은 줄이고, "내가 잘하고 있구나"라는 안도감과 애정이 커지도록 위로형 톤으로 작성하세요.
문장은 다정하고 부드럽게, 보호자의 하루를 따뜻하게 감싸는 느낌으로 표현하세요.
반려동물의 습관에 비유해 보호자가 바로 이해할 수 있게 작성하세요.
문단 나눔 없이 한 단락으로 작성하고, 마지막 문장은 보호자에게 실천 가능한 짧은 조언으로 끝내세요.
${intensity}`;
}

function buildExpansionPrompt(baseText: string, minLength: number) {
  return `다음 문장을 바탕으로 내용의 핵심은 유지하되, 사주 전문 용어를 자연스럽게 포함해서 한 단락으로 확장해 주세요.
입력 데이터(이름, 견종, 생년월일, 생시, 성별)는 본문에 직접 노출하지 마세요.
반드시 "보호자님, 아이는"으로 시작하고 공백 포함 최소 ${minLength}자 이상으로 작성하세요.
문장은 끝까지 완결하고 따뜻한 한국어로 작성하세요.
원문: "${baseText}"`;
}

function ensureMinLength(text: string, name: string, minLength: number) {
  if (text.length >= minLength) return text;

  const fallback = ` ${name}의 오행 균형은 계절의 흐름에 맞춰 서서히 안정되며, 보호자님의 따뜻한 돌봄이 용신의 작용을 도와 대운의 상승 구간을 더 부드럽게 열어줍니다.`;
  let expanded = `${text}${fallback}`.trim();
  while (expanded.length < minLength) {
    expanded = `${expanded}${fallback}`.trim();
  }
  return expanded;
}

function buildLocalPreview(name: string) {
  const base = `보호자님, 아이는 처음엔 주변의 공기를 천천히 읽고 다가오지만 마음이 열리면 생각보다 깊고 따뜻하게 교감하는 기질을 타고났어요. 사주 흐름에서 일간의 중심이 단단해 감정 회복이 빠른 편이고, 월지와 시주의 리듬이 맞는 날에는 눈빛과 몸짓이 더 부드럽게 살아나며 반응 속도도 좋아집니다. 오행 균형이 크게 치우치지 않아 보호자님의 일관된 루틴이 들어오면 하루 컨디션이 안정적으로 정돈되는 장점이 커요. 지금처럼 다정한 목소리로 짧게 칭찬하고 산책-휴식 리듬을 지켜 주시면, ${name || "아이"}의 좋은 기운은 오래 포근하게 유지됩니다.`;
  return ensureMinLength(base.trim(), name || "아이", MIN_PREVIEW_LENGTH);
}

function buildLocalFullReport(
  _name: string,
  _breed: string,
  _gender: string,
  _birth: string,
  _birthTime: string
) {
  return `1. 핵심 기질\n아이의 기본 결은 겉으로는 부드럽고 순한데, 안쪽에는 자기 리듬을 지키는 단단함이 함께 있어요. 낯선 자극을 만나면 먼저 관찰하고 천천히 다가가는 타입이라, 보호자가 마음을 읽어주는 순간 신뢰가 빠르게 깊어집니다. 일간의 중심이 안정적이라 감정 회복도 빠른 편이에요.\n\n2. 오행 밸런스와 생활 루틴\n오행 흐름은 한쪽으로 크게 치우치지 않아 루틴 관리에서 강점이 잘 드러납니다. 월지·시주 흐름이 맞는 날에는 학습 반응과 교감 신호가 함께 살아나고, 흔들리는 날에는 짧은 휴식과 안정 신호가 먼저 필요합니다. 산책-놀이-휴식의 반복이 운의 결을 예쁘게 정리해 줍니다.\n\n3. 관계운과 교감 포인트\n관계운은 느리게 열리지만 한 번 연결되면 오래 가는 깊은 결입니다. 보호자의 표정·목소리·속도에 민감하게 반응하기 때문에, 강한 훈육보다 짧고 따뜻한 신호가 훨씬 효과적이에요. 즉시 칭찬하는 방식이 용신 흐름을 도와 안정감과 자신감을 같이 키워 줍니다.\n\n4. 2026년 흐름\n2026년은 상반기 확장, 하반기 안정의 흐름이 분명한 해예요. 상반기에는 새로운 자극을 작게 늘려 탐색력과 사회성을 키우고, 하반기에는 익숙한 루틴으로 컨디션을 고정하면 운의 상승이 더 길게 이어집니다. 큰 변화보다 작은 성공 경험을 자주 만드는 전략이 유리합니다.\n\n5. 보호자 실천 조언\n아이의 운을 살리는 핵심은 완벽함보다 일관성입니다. 하루 리듬을 비슷하게 지키고, 잘한 순간 3초 안에 다정하게 칭찬해 주세요. 이 단순한 습관이 아이의 기운을 안정시키고, 보호자와의 관계를 더 포근하게 단단히 묶어 줍니다.`;
}

export async function POST(req: Request) {
  try {
    const { name, birth, birthTime, breed, gender, full } = await req.json();
    const API_KEY = process.env.GEMINI_API_KEY;
    const safeBirthTime = normalizeBirthTime(birthTime);
    const safeGender = normalizeGender(gender);
    if (!API_KEY) throw new Error("API 키가 설정되지 않았습니다.");

    const prompt = full
      ? `반려동물 평생 사주 리포트를 따뜻하고 전문적으로 한국어로 작성하세요.
         입력 데이터(이름, 견종, 생년월일, 생시, 성별)는 내부 해석에만 사용하고, 본문에서 직접 언급하지 마세요.
         구조: 1. 핵심 기질 2. 오행 밸런스와 생활 루틴 3. 관계운과 교감 포인트 4. 2026년 흐름 5. 보호자 실천 조언
         주요 타겟은 20-40대 여성 보호자입니다. 정서적 공감과 안도감이 느껴지도록 다정하고 섬세한 문체로 작성하세요.
         실제 명리 상담처럼 디테일하게 쓰되, 사주 용어는 쉽게 풀어 보호자가 이해할 수 있게 설명하세요.`
      : buildPreviewPrompt(name, breed, birth, safeBirthTime, safeGender, MIN_PREVIEW_LENGTH, 1);

    const generate = async (textPrompt: string) => {
      // 실제 테스트로 작동이 확인된 models/gemini-2.5-flash 사용 (v1)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: textPrompt }] }],
            generationConfig: { maxOutputTokens: full ? 2000 : 700, temperature: 0.8 }
          }),
        }
      );

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!resultText) throw new Error("AI 응답 생성 실패");
      return resultText.trim();
    };

    let resultText = "";

    if (full) {
      try {
        resultText = await generate(prompt);
      } catch (fullError) {
        console.error("Full report fallback:", fullError);
        resultText = buildLocalFullReport(name, breed, safeGender, birth, safeBirthTime);
      }
    } else {
      try {
        resultText = await generate(prompt);
        let attempt = 1;
        while (resultText.length < MIN_PREVIEW_LENGTH && attempt < 3) {
          attempt += 1;
          resultText = await generate(
            buildPreviewPrompt(name, breed, birth, safeBirthTime, safeGender, MIN_PREVIEW_LENGTH, attempt)
          );
        }
        if (resultText.length < MIN_PREVIEW_LENGTH) {
          resultText = await generate(buildExpansionPrompt(resultText, 260));
        }
      } catch (previewError) {
        console.error("Preview generation fallback:", previewError);
        resultText = buildLocalPreview(name);
      }
      resultText = ensureMinLength(resultText, name, MIN_PREVIEW_LENGTH);
    }

    return NextResponse.json({ result: resultText });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
