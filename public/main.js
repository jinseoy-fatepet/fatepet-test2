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
  const resultArea = document.getElementById('result-area');
  const resultContent = document.getElementById('result-content');
  const analyzeBtn = document.getElementById('analyze-btn');

  loading.style.display = 'block';
  resultArea.style.display = 'none';
  analyzeBtn.disabled = true;
  analyzeBtn.style.opacity = '0.7';

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

    resultContent.innerText = data.result;
    resultArea.style.display = 'block';
    
    // Smooth scroll to result
    resultArea.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    alert('분석 중 오류가 발생했습니다: ' + error.message);
  } finally {
    loading.style.display = 'none';
    analyzeBtn.disabled = false;
    analyzeBtn.style.opacity = '1';
  }
});
