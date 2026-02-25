const loadingMessages = [
  "AI 명리학자가 우주의 기운을 분석 중입니다...",
  "별자리의 흐름과 견종의 특성을 대조하고 있어요...",
  "우리 아이의 타고난 기운을 읽어내는 중입니다...",
  "행복한 반려 생활을 위한 조언을 정리하고 있습니다..."
];

document.getElementById('analyze-btn').addEventListener('click', async () => {
  const name = document.getElementById('name').value;
  const birthdate = document.getElementById('birthdate').value;
  const birthtime = document.getElementById('birthtime').value;
  const breed = document.getElementById('breed').value;
  const gender = document.getElementById('gender').value;

  if (!name || !birthdate || !breed) {
    alert('아이의 이름, 생년월일, 견종을 입력해주세요!');
    return;
  }

  const loading = document.getElementById('loading');
  const loadingText = loading.querySelector('p');
  const resultArea = document.getElementById('result-area');
  const resultContent = document.getElementById('result-content');
  const analyzeBtn = document.getElementById('analyze-btn');

  // 로딩 시작
  loading.style.display = 'block';
  resultArea.style.display = 'none';
  analyzeBtn.disabled = true;
  analyzeBtn.style.opacity = '0.7';

  // 로딩 메시지 순환
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % loadingMessages.length;
    loadingText.innerText = loadingMessages[msgIdx];
  }, 2000);

  try {
    const response = await fetch('/api/saju', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        birthdate,
        birthtime,
        breed,
        gender
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // 결과 출력 및 포맷팅 (개행 처리)
    resultContent.innerText = data.result;
    resultArea.style.display = 'block';
    
    // 부드럽게 결과창으로 이동
    setTimeout(() => {
      resultArea.scrollIntoView({ behavior: 'smooth' });
    }, 100);

  } catch (error) {
    console.error(error);
    // 구체적인 에러 메시지를 사용자에게 보여줍니다.
    alert('분석 중 오류 발생: ' + error.message);
  } finally {
    clearInterval(msgInterval);
    loading.style.display = 'none';
    analyzeBtn.disabled = false;
    analyzeBtn.style.opacity = '1';
  }
});
