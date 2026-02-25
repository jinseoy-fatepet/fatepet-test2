export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { name, birthdate, birthtime, breed, gender } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다. Vercel 환경 변수에서 OPENAI_API_KEY를 추가해 주세요.' });
  }

  try {
    const prompt = `반려견 사주 분석: 이름:${name}, 생일:${birthdate}, 시간:${birthtime}, 품종:${breed}, 성별:${gender}. 명리학 전문가로서 따뜻하고 상세하게 분석해줘.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "당신은 전문 반려견 명리학자입니다." },
          { role: "user", content: prompt }
        ]
      })
    });

    const json = await response.json();
    if (json.error) throw new Error(json.error.message);

    res.status(200).json({ result: json.choices[0].message.content });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
