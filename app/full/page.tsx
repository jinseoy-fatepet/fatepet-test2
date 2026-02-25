"use client";

import { useEffect, useState, useRef } from "react";
import { Download, Share2, Home } from "lucide-react";
import { toPng } from "html-to-image";
import confetti from "canvas-confetti";

export default function FullResult() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState({
    name: "",
    birth: "",
    breed: "",
    gender: "",
    image: ""
  });

  useEffect(() => {
    const name = localStorage.getItem("dogName") || "";
    const birth = localStorage.getItem("dogBirth") || "";
    const breed = localStorage.getItem("dogBreed") || "";
    const gender = localStorage.getItem("dogGender") || "";
    const image = localStorage.getItem("dogImage") || "";

    setData({ name, birth, breed, gender, image });

    fetch("/api/fortune", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, birth, breed, gender, full: true })
    })
    .then(res => res.json())
    .then(data => {
      setResult(data.result);
      setLoading(false);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#d946ef', '#f59e0b']
      });
    });
  }, []);

  const downloadImage = async () => {
    if (reportRef.current === null) return;
    const dataUrl = await toPng(reportRef.current, { cacheBust: true });
    const link = document.createElement('a');
    link.download = `${data.name}-saju-report.png`;
    link.href = dataUrl;
    link.click();
  };

  if (loading) return (
    <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>
      <p>전체 사주 리포트를 작성 중입니다...</p>
    </div>
  );

  return (
    <main className="container">
      <h1>🏆 전체 분석 리포트</h1>
      
      <div ref={reportRef} className="card" style={{ background: '#18181b', padding: '40px 30px' }}>
        <div className="dog-image-container" style={{ width: '120px', height: '120px', marginBottom: '20px' }}>
          <img src={data.image} alt={data.name} />
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '5px' }}>{data.name}의 상세 사주</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{data.birth} | {data.breed}</p>
        </div>

        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', color: '#e2e8f0', fontSize: '1rem', textAlign: 'left' }}>
          {result}
        </div>

        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>반려견 사주 분석 AI | © 2026 FatePet</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '30px' }}>
        <button onClick={downloadImage} style={{ background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Download size={18} />
          이미지 저장
        </button>
        <button style={{ background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Share2 size={18} />
          공유하기
        </button>
      </div>

      <button 
        onClick={() => window.location.href = '/'}
        style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        <Home size={18} />
        홈으로 돌아가기
      </button>
    </main>
  );
}
