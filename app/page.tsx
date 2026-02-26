"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PawPrint } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const defaultImage = "/default-dog.svg";

  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [birthTime, setBirthTime] = useState("unknown");
  const [breed, setBreed] = useState("");
  const [gender, setGender] = useState("male");
  const [image, setImage] = useState(defaultImage);

  const onPickImage = (file?: File | null) => {
    if (!file) {
      setImage(defaultImage);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !birth || !breed) {
      alert("이름, 생년월일, 견종을 입력해주세요.");
      return;
    }

    localStorage.setItem("dogName", name);
    localStorage.setItem("dogBirth", birth);
    localStorage.setItem("dogBirthTime", birthTime);
    localStorage.setItem("dogBreed", breed);
    localStorage.setItem("dogGender", gender);
    localStorage.setItem("dogImage", image || defaultImage);

    router.push("/result");
  };

  return (
    <main className="saju-container">
      <section className="saju-hero">
        <p className="saju-badge">SajuAI</p>
        <h1>사주아이 반려견 사주</h1>
        <p>우리 아이의 기질과 교감 흐름을 감성적으로 읽어드려요.</p>
      </section>

      <section className="saju-card">
        <div className="saju-avatar-wrap">
          <img
            src={image || defaultImage}
            alt="반려견 프로필"
            className="saju-avatar"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.endsWith(defaultImage)) return;
              target.src = defaultImage;
              setImage(defaultImage);
            }}
          />
        </div>

        <form onSubmit={handleSubmit} className="saju-form">
          <label>사진 업로드(선택)</label>
          <input type="file" accept="image/*" onChange={(e) => onPickImage(e.target.files?.[0])} />

          <label>반려견 이름</label>
          <input placeholder="예: 후추" value={name} onChange={(e) => setName(e.target.value)} />

          <label>생년월일</label>
          <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />

          <label>태어난 시간</label>
          <select value={birthTime} onChange={(e) => setBirthTime(e.target.value)}>
            <option value="unknown">모름</option>
            <option value="00:00">자시 (23~01)</option>
            <option value="02:00">축시 (01~03)</option>
            <option value="04:00">인시 (03~05)</option>
            <option value="06:00">묘시 (05~07)</option>
            <option value="08:00">진시 (07~09)</option>
            <option value="10:00">사시 (09~11)</option>
            <option value="12:00">오시 (11~13)</option>
            <option value="14:00">미시 (13~15)</option>
            <option value="16:00">신시 (15~17)</option>
            <option value="18:00">유시 (17~19)</option>
            <option value="20:00">술시 (19~21)</option>
            <option value="22:00">해시 (21~23)</option>
          </select>

          <label>견종</label>
          <input placeholder="예: 푸들" value={breed} onChange={(e) => setBreed(e.target.value)} />

          <label>성별</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="male">남아</option>
            <option value="female">여아</option>
          </select>

          <button type="submit" className="saju-primary-btn">
            <PawPrint size={18} /> 사주 분석 시작하기
          </button>
        </form>
      </section>
    </main>
  );
}
