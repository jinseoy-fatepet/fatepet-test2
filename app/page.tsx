"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PawPrint } from "lucide-react";

export default function Home() {
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [breed, setBreed] = useState("");
  const [gender, setGender] = useState("male");
  const [image, setImage] = useState("https://images.unsplash.com/photo-1543466835-00a732f3b9a1?q=80&w=300&auto=format&fit=crop");

  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !birth || !breed) {
      alert("모든 정보를 입력해주세요!");
      return;
    }

    localStorage.setItem("dogName", name);
    localStorage.setItem("dogBirth", birth);
    localStorage.setItem("dogBreed", breed);
    localStorage.setItem("dogGender", gender);
    localStorage.setItem("dogImage", image);

    router.push("/result");
  };

  return (
    <main className="container">
      <h1>🐶 반려견 사주 분석</h1>

      <div className="card">
        <div className="dog-image-container">
          <img src={image} alt="반려견 기본 이미지" />
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#94a3b8' }}>반려견 이름</label>
          <input
            placeholder="예: 초코, 보리"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#94a3b8' }}>생년월일</label>
          <input
            type="date"
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
          />

          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#94a3b8' }}>견종</label>
          <input
            placeholder="예: 푸들, 말티즈"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          />

          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#94a3b8' }}>성별</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="male">남아</option>
            <option value="female">여아</option>
          </select>

          <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <PawPrint size={20} />
            아이 사주 확인하기
          </button>
        </form>
      </div>

      <p style={{ textAlign: 'center', marginTop: '30px', color: '#64748b', fontSize: '0.85rem' }}>
        이미지는 기본 이미지로 설정되며, 결과 페이지에서 <br/>다양한 캐릭터로 변경할 수 있습니다.
      </p>
    </main>
  );
}
