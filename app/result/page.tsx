"use client";

import { useEffect, useState } from "react";
import { CreditCard, Lock, Undo2 } from "lucide-react";

export default function ResultPage() {
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState("");
  const [data, setData] = useState({ name: "", birth: "", birthTime: "", breed: "", gender: "", image: "" });
  const defaultImage = "/default-dog.svg";
  const paymentMode = process.env.NEXT_PUBLIC_PAYMENT_MODE === "live" ? "live" : "test";

  useEffect(() => {
    const name = localStorage.getItem("dogName") || "우리 아이";
    const birth = localStorage.getItem("dogBirth") || "";
    const rawBirthTime = localStorage.getItem("dogBirthTime") || "";
    const birthTime = rawBirthTime === "unknown" ? "" : rawBirthTime;
    const breed = localStorage.getItem("dogBreed") || "";
    const gender = localStorage.getItem("dogGender") || "";
    const rawImage = localStorage.getItem("dogImage") || "";
    const image = rawImage && rawImage !== "null" && rawImage !== "undefined" ? rawImage : defaultImage;

    setData({ name, birth, birthTime, breed, gender, image });

    fetch("/api/fortune", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, birth, birthTime, breed, gender, full: false }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setPreview(json.result || "결과 생성 실패");
      })
      .catch((e: any) => setError(e.message || "분석 오류"))
      .finally(() => setLoading(false));
  }, []);

  const openFull = async () => {
    if (isOpening) return;
    setIsOpening(true);
    setOpenError("");
    if (paymentMode === "test") {
      window.location.assign("/full");
      return;
    }

    try {
      const res = await fetch("/api/create-checkout", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "결제 세션 생성 실패");
      if (!json.url) throw new Error("결제 페이지 주소를 받지 못했습니다.");
      window.location.assign(json.url);
    } catch (e: any) {
      setOpenError(e.message || "결제 이동 실패");
      setIsOpening(false);
    }
  };

  return (
    <main className="saju-container">
      <h1 className="page-title">사주아이 리포트</h1>

      <section className="report-card">
        <div className="report-head">
          <img
            src={data.image || defaultImage}
            alt="반려견"
            className="report-avatar"
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.endsWith(defaultImage)) return;
              t.src = defaultImage;
            }}
          />
          <div>
            <h2>{data.name}</h2>
            <p>{data.breed} · {data.birth || "생년월일 미입력"}</p>
          </div>
        </div>

        <div className="preview-panel">
          {loading ? <p>아이의 기운을 읽는 중이에요...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {!loading && !error ? <p>{preview}</p> : null}
        </div>

        <div className="locked-panel">
          <div className="blur-lines">
            <p>사주팔자 해석 · 오행분석 · 십성분포</p>
            <p>이름분석 · 견종궁합 · 행운컬러/방향</p>
            <p>2026년 흐름 + 보호자 실천 가이드</p>
          </div>

          <div className="lock-overlay">
            <div className="lock-icon-wrap"><Lock size={20} /></div>
            <p className="lock-title">전체 리포트 잠금</p>
            <p className="lock-desc">
              {paymentMode === "test"
                ? "테스트 모드에서는 결제 없이 전체 리포트를 바로 열 수 있어요."
                : "실결제 모드입니다. 결제 후 전체 리포트가 열립니다."}
            </p>
            <button className="saju-primary-btn" onClick={openFull}>
              <CreditCard size={18} /> {isOpening ? "열어보는 중..." : paymentMode === "test" ? "전체 사주 보기 (테스트)" : "결제하고 전체 보기"}
            </button>
            {openError ? <p className="error-text" style={{ marginTop: "8px" }}>{openError}</p> : null}
          </div>
        </div>
      </section>

      <button className="back-btn" onClick={() => (window.location.href = "/")}> 
        <Undo2 size={16} /> 처음으로
      </button>
    </main>
  );
}
