export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/saju" && request.method === "POST") {
      try {
        const { name, birthdate, birthtime, breed, gender } = await request.json();

        if (!env.OPENAI_API_KEY) {
          return new Response(JSON.stringify({ error: "API 키가 설정되지 않았습니다." }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }

        const prompt = `반려견 사주 분석: 이름:${name}, 생일:${birthdate}, 시간:${birthtime}, 품종:${breed}, 성별:${gender}. 명리학 전문가로서 따뜻하고 상세하게 분석해줘.`;

        // OpenAI API 호출 시 헤더 보강 및 모델 변경 시도
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          body: JSON.stringify({
            model: "gpt-4o", // gpt-4o-mini보다 안정적인 gpt-4o 사용
            messages: [
              { role: "system", content: "당신은 전문 반려견 명리학자입니다." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7
          })
        });

        const json = await response.json();
        
        if (json.error) {
          // 에러가 지역 제한 관련이면 더 상세한 가이드 제공
          if (json.error.code === "unsupported_country_region_territory" || json.error.message.includes("Country")) {
            return new Response(JSON.stringify({ 
              error: "OpenAI가 현재 접속 지역(Cloudflare 노드)을 지원하지 않습니다. 잠시 후 다시 시도하거나, Cloudflare 프로젝트 설정에서 지역 설정을 확인해 주세요." 
            }), {
              status: 403,
              headers: { "Content-Type": "application/json" }
            });
          }
          throw new Error(json.error.message);
        }

        return new Response(JSON.stringify({ result: json.choices[0].message.content }), {
          headers: { "Content-Type": "application/json; charset=utf-8" }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
