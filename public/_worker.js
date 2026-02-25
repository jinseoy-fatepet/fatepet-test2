export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. API 요청 처리 (/api/saju)
    if (url.pathname === "/api/saju" && request.method === "POST") {
      try {
        const { name, birthdate, birthtime, breed, gender } = await request.json();

        if (!env.OPENAI_API_KEY) {
          return new Response(JSON.stringify({ error: "API 키가 설정되지 않았습니다. Cloudflare Workers 설정에서 OPENAI_API_KEY를 추가해 주세요." }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }

        const prompt = `반려견 사주 분석: 이름:${name}, 생일:${birthdate}, 시간:${birthtime}, 품종:${breed}, 성별:${gender}. 명리학 기반 오행, 성격, 행동, 양육법, 궁합을 상세히 분석해줘.`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "당신은 전문 반려견 명리학자입니다." }, { role: "user", content: prompt }]
          })
        });

        const json = await response.json();
        if (json.error) throw new Error(json.error.message);

        return new Response(JSON.stringify({ result: json.choices[0].message.content }), {
          headers: { "Content-Type": "application/json" }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 2. 그 외 모든 요청은 정적 파일(Assets)로 전달
    return env.ASSETS.fetch(request);
  }
};
