export async function onRequestPost(context) {
  const { request, env } = context;
  
  // API 키가 설정되었는지 먼저 확인
  if (!env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ 
      error: "Cloudflare 환경 변수에 OPENAI_API_KEY가 설정되지 않았습니다. Settings -> Variables에서 확인해 주세요." 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  try {
    const { name, birthdate, birthtime, breed, gender } = await request.json();

    const prompt = `
반려견 사주 분석:
이름: ${name}
생일: ${birthdate}
출생시간: ${birthtime}
품종: ${breed}
성별: ${gender}

명리학 기반으로 오행 분석, 성격, 행동 특성, 양육 방법, 보호자 궁합을 전문 명리학 스타일로 상세히 작성하세요.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // 더 넓은 호환성을 위해 gpt-4o-mini로 변경 시도
        messages: [
          { role: "system", content: "당신은 전문 반려견 명리학자입니다." },
          { role: "user", content: prompt }
        ]
      })
    });

    const json = await response.json();
    
    if (json.error) {
      // OpenAI가 직접 돌려준 에러 메시지를 반환
      return new Response(JSON.stringify({ 
        error: `OpenAI 에러: ${json.error.message}` 
      }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result = json.choices[0].message.content;
    
    return new Response(JSON.stringify({ result }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: `서버 내부 에러: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
