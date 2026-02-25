import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { name, birth, breed, gender, full } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = full
      ? `반려견 사주 전문가로서, 다음 정보를 바탕으로 매우 상세하고 따뜻한 전체 사주 분석을 작성해주세요. 
         이름: ${name}, 생일: ${birth}, 견종: ${breed}, 성별: ${gender}.
         포함할 내용: 
         1. 오행 분석 (기운)
         2. 타고난 성격 및 기질
         3. 올해의 건강운과 재물운(보호자에게 주는 운)
         4. 행동 특성 및 훈련 팁
         5. 보호자와의 궁합 및 조언.
         전문적이면서도 반려인의 마음을 어루만지는 문체로 작성해주세요.`
      : `${name}(${breed}, ${gender}, ${birth}년생)의 반려견 사주를 명리학적으로 분석하여, 
         앞으로의 운명이나 성격을 '딱 한 문장'으로만 신비롭고 흥미롭게 요약해줘. (맛보기용)`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ result: text });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
