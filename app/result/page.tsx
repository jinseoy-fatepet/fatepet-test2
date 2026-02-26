"use client";

import { useEffect, useState } from "react";
import { CreditCard, Undo2 } from "lucide-react";

type ReadingResponse = {
  id: string;
  preview: string;
  full: string;
  image_url: string;
  is_paid: boolean;
};

export default function ResultPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState("");
  const [reading, setReading] = useState<ReadingResponse | null>(null);
  const [data, setData] = useState({
    name: "",
    birthdate: "",
    birthtime: "",
    gender: "",
    image: "",
  });

  const defaultImage = "/default-dog.svg";
  const paymentMode = process.env.NEXT_PUBLIC_PAYMENT_MODE === "live" ? "live" : "test";

  useEffect(() => {
    const name = localStorage.getItem("dogName") || "우리 아이";
    const birthdate = localStorage.getItem("dogBirth") || "";
    const rawBirthtime = localStorage.getItem("dogBirthTime") || "unknown";
    const birthtime = rawBirthtime === "unknown" ? "unknown" : rawBirthtime;
    const gender = localStorage.getItem("dogGender") || "male";
    const rawImage = localStorage.getItem("dogImage") || "";
    const image = rawImage && rawImage !== "null" && rawImage !== "undefined" ? rawImage : defaultImage;

    setData({ name, birthdate, birthtime, gender, image });

    const requestReading = async () => {
      try {
        const readingId = localStorage.getItem("readingId");
        if (readingId) {
          const existingRes = await fetch(`/api/reading?id=${encodeURIComponent(readingId)}`);
          if (existingRes.ok) {
            const existing = (await existingRes.json()) as ReadingResponse;
            setReading(existing);
            setLoading(false);
            return;
          }
        }

        const res = await fetch("/api/reading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, birthdate, birthtime, gender }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "리딩 생성 실패");
        setReading(json as ReadingResponse);
        localStorage.setItem("readingId", json.id);
      } catch (e: any) {
        setError(e.message || "리딩 생성 오류");
      } finally {
        setLoading(false);
      }
    };

    requestReading();
  }, []);

  const openPayment = async () => {
    if (!reading?.id || isOpening) return;
    setIsOpening(true);
    setOpenError("");

    if (paymentMode === "test") {
      setReading((prev) => (prev ? { ...prev, is_paid: true } : prev));
      setIsOpening(false);
      return;
    }

    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingId: reading.id }),
      });
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
      <h1 className="page-title">FatePet Reading</h1>

      <section className="report-card">
        <div className="report-head">
          <img
            src={reading?.image_url || data.image || defaultImage}
            alt="반려견"
            className="report-avatar"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.endsWith(defaultImage)) return;
              target.src = defaultImage;
            }}
          />
          <div>
            <h2>{data.name}</h2>
            <p>{data.birthdate || "생년월일 미입력"}</p>
          </div>
        </div>

        <div className="preview-panel">
          {loading ? <p>리딩 생성 중...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {!loading && !error ? <p>{reading?.preview || "미리보기를 불러오지 못했습니다."}</p> : null}
        </div>

        <div className="locked-panel">
          <div
            className="full-content"
            style={{
              filter: reading?.is_paid ? "none" : "blur(6px)",
              opacity: reading?.is_paid ? 1 : 0.45,
              minHeight: "240px",
            }}
          >
            {reading?.full || "전체 리딩 생성 중입니다."}
          </div>

          {!reading?.is_paid ? (
            <div className="lock-overlay">
              <p className="lock-title">전체 리딩 잠금</p>
              <p className="lock-desc">
                {paymentMode === "test"
                  ? "테스트 모드에서는 버튼 클릭 시 전체 리딩이 바로 열립니다."
                  : "결제 완료 후 전체 리딩과 이미지를 확인할 수 있습니다."}
              </p>
              <button className="saju-primary-btn" onClick={openPayment}>
                <CreditCard size={18} />
                {isOpening ? "이동 중..." : "결제하고 전체 보기"}
              </button>
              {openError ? <p className="error-text" style={{ marginTop: "8px" }}>{openError}</p> : null}
            </div>
          ) : null}
        </div>
      </section>

      <button className="back-btn" onClick={() => (window.location.href = "/")}>
        <Undo2 size={16} /> 처음으로
      </button>
    </main>
  );
}
