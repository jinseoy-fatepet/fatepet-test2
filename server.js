import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/saju', async (req, res) => {
  const { name, birthdate, birthtime, breed, gender } = req.body;

  const prompt = `
반려견 사주 분석:

이름: ${name}
생일: ${birthdate}
출생시간: ${birthtime}
품종: ${breed}
성별: ${gender}

명리학 기반으로:
- 오행 분석 (목, 화, 토, 금, 수의 기운)
- 타고난 성격 및 기질
- 행동 특성과 주의해야 할 습관
- 스트레스 해소 및 행복을 위한 양육 방법
- 보호자와의 에너지 궁합 및 조언

반려견의 관점에서 따뜻하면서도 전문적인 명리학 스타일로 상세하게 작성하세요.
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o", // gpt-5 is not yet available, using gpt-4o for best results
        messages: [
          {
            role: "system",
            content: "당신은 전문 반려견 명리학자이자 소통 전문가입니다. 반려견의 생년월일과 정보를 바탕으로 심도 깊은 사주 풀이를 제공합니다."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message);
    }

    const result = json.choices[0].message.content;
    res.json({ result });
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    res.status(500).json({ error: "사주 분석 중 오류가 발생했습니다. API 키를 확인해주세요." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
