"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Home } from "lucide-react";
import { toPng } from "html-to-image";

export default function FullPage() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ name: "", birth: "", birthTime: "", breed: "", gender: "", image: "" });
  const reportRef = useRef<HTMLDivElement>(null);
  const defaultImage = "/default-dog.svg";

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
      body: JSON.stringify({ name, birth, birthTime, breed, gender, full: true }),
    })
      .then((res) => res.json())
      .then((json) => setResult(json.result || "전체 리포트 생성 실패"))
      .finally(() => setLoading(false));
  }, []);

  const download = async () => {
    if (!reportRef.current) return;
    const dataUrl = await toPng(reportRef.current, { cacheBust: true });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${data.name || "pet"}-full-report.png`;
    a.click();
  };

  if (loading) {
    return <main className="saju-container"><p style={{ textAlign: "center" }}>전체 리포트를 작성 중입니다...</p></main>;
  }

  return (
    <main className="saju-container">
      <h1 className="page-title">전체 사주 리포트</h1>

      <section className="report-card" ref={reportRef}>
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
            <h2>{data.name} 전체 리포트</h2>
            <p>{data.breed} · {data.birth || "생년월일 미입력"}</p>
          </div>
        </div>

        <div className="full-content">{result}</div>
      </section>

      <div className="full-actions">
        <button className="ghost-btn" onClick={download}><Download size={16} /> 이미지 저장</button>
        <button className="ghost-btn" onClick={() => (window.location.href = "/")}><Home size={16} /> 홈으로</button>
      </div>
    </main>
  );
}
