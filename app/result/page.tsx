"use client";

import { useEffect, useState } from "react";
import { Lock, CreditCard, RefreshCw, Sparkles } from "lucide-react";

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
    const name = localStorage.getItem("dogName") || "아이";
    const birth = localStorage.getItem("dogBirth") || "";
    const breed = localStorage.getItem("dogBreed") || "";
    const gender = localStorage.getItem("dogGender") || "";
    const image = localStorage.getItem("dogImage") || "https://images.unsplash.com/photo-1543466835-00a732f3b9a1?q=80&w=300&auto=format&fit=crop";

    setData({ name, birth, breed, gender, image });

    const fetchFortune = async () => {
      try {
        const res = await fetch("/api/fortune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, birth, breed, gender, full: false })
        });
        const json = await res.json();
        setPreview(json.result || "분석 결과를 가져오지 못했습니다.");
      } catch (err) {
        setPreview("서버 통신 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchFortune();
  }, []);

  const handlePayment = async () => {
    try {
      const res = await fetch("/api/create-checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("결제 페이지를 불러오지 못했습니다.");
      }
    } catch (err) {
      alert("결제 요청 중 오류가 발생했습니다.");
    }
  };

  return (
    <main className="container">
      <h1>✨ 분석 결과</h1>
      
      <div className="card" style={{ position: 'relative' }}>
        <div className="dog-image-outer">
          <div className="dog-image-glow"></div>
          <div className="dog-image-container">
            <img src={data.image} alt={data.name} />
          </div>
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white', marginBottom: '4px' }}>
            {data.name}의 운명
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{data.breed} | {data.birth}</p>
        </div>

        <div style={{ 
          background: 'rgba(139, 92, 246, 0.08)', 
          padding: '24px', 
          borderRadius: '20px', 
          marginBottom: '40px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          minHeight: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {loading ? (
            <div style={{ width: '100%' }}>
              <div className="skeleton" style={{ width: '80%', margin: '0 auto 12px' }}></div>
              <div className="skeleton" style={{ width: '60%', margin: '0 auto' }}></div>
            </div>
          ) : (
            <p className="preview-text">
              <Sparkles size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
              {preview}
            </p>
          )}
        </div>

        <div style={{ position: 'relative', height: '200px', borderRadius: '24px', overflow: 'hidden', background: '#1c1c21' }}>
          <div style={{ padding: '24px', opacity: 0.2, userSelect: 'none' }}>
            <div className="skeleton" style={{ width: '90%', marginBottom: '16px' }}></div>
            <div className="skeleton" style={{ width: '100%', marginBottom: '16px' }}></div>
            <div className="skeleton" style={{ width: '85%', marginBottom: '16px' }}></div>
            <div className="skeleton" style={{ width: '70%' }}></div>
          </div>
          
          <div className="blur-overlay">
            <div style={{ 
              background: 'rgba(39, 39, 42, 0.8)', 
              padding: '16px', 
              borderRadius: '50%', 
              marginBottom: '12px', 
              border: '1px solid rgba(139, 92, 246, 0.3)',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)'
            }}>
              <Lock size={20} color="#a78bfa" />
            </div>
            <p style={{ fontWeight: '700', fontSize: '1.05rem', marginBottom: '4px' }}>전체 사주 리포트</p>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>보이지 않는 운명의 상세한 내용 확인</p>
          </div>
        </div>

        <button 
          onClick={handlePayment}
          style={{ 
            marginTop: '32px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px',
            fontSize: '1.15rem'
          }}
        >
          <CreditCard size={22} />
          전체 사주 보기 (₩4,900)
        </button>
      </div>

      <button 
        onClick={() => window.location.href = '/'}
        style={{ 
          marginTop: '20px', 
          background: 'transparent', 
          border: '1px solid rgba(255,255,255,0.05)', 
          color: '#64748b',
          fontSize: '0.95rem',
          boxShadow: 'none'
        }}
      >
        <RefreshCw size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        다시 입력하기
      </button>
    </main>
  );
}
