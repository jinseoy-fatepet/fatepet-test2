"use client";

import { useEffect, useState } from "react";
import { Lock, Sparkles, CreditCard } from "lucide-react";

export default function Result() {
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(true);
  
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
      body: JSON.stringify({ name, birth, breed, gender, full: false })
    })
    .then(res => res.json())
    .then(data => {
      setPreview(data.result);
      setLoading(false);
    });
  }, []);

  const handlePayment = async () => {
    const res = await fetch("/api/create-checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("결제 페이지를 불러오지 못했습니다.");
    }
  };

  if (loading) return (
    <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>
      <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeftColor: '#8b5cf6', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
      <p>명리학자가 우주의 기운을 분석 중...</p>
      <style jsx>{` @keyframes spin { to { transform: rotate(360deg); } } `}</style>
    </div>
  );

  return (
    <main className="container">
      <h1>✨ 분석 결과</h1>
      
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="dog-image-container">
          <img src={data.image} alt={data.name} />
        </div>
        
        <h2 style={{ marginBottom: '10px' }}>{data.name}의 운명</h2>
        <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '20px', borderRadius: '16px', marginBottom: '30px' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#c084fc', lineHeight: '1.6' }}>
            "{preview}"
          </p>
        </div>

        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
          <div style={{ filter: 'blur(8px)', opacity: 0.3, pointerEvents: 'none', userSelect: 'none', textAlign: 'left' }}>
            <p style={{ marginBottom: '10px' }}>우리 아이의 오행 기운은 목(木)의 성질이 강하며...</p>
            <p style={{ marginBottom: '10px' }}>성격은 매우 활달하고 보호자에게 헌신적이며...</p>
            <p style={{ marginBottom: '10px' }}>올해는 특히 신장 계통의 건강을 주의해야 하며...</p>
            <p style={{ marginBottom: '10px' }}>재물운은 보호자에게 금전적 이득을 가져다 줄...</p>
          </div>
          
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(24, 24, 27, 0.6)' }}>
            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '50%', marginBottom: '15px', border: '1px solid var(--primary)' }}>
              <Lock size={24} color="#8b5cf6" />
            </div>
            <p style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '5px' }}>잠겨있는 상세 분석 내용</p>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>전체 사주 리포트에서 확인하세요</p>
          </div>
        </div>

        <button 
          onClick={handlePayment}
          style={{ marginTop: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'var(--gradient)' }}
        >
          <CreditCard size={20} />
          🔓 전체 사주 보기 (₩4,900)
        </button>
      </div>

      <button 
        onClick={() => window.location.href = '/'}
        style={{ marginTop: '20px', background: 'transparent', border: '1px solid var(--card-border)', color: '#94a3b8' }}
      >
        다시 입력하기
      </button>
    </main>
  );
}
