"use client";

import { useEffect, useMemo, useState } from "react";
import "./globals.css";

export default function Home() {
  const [places, setPlaces] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [selectedType, setSelectedType] = useState("전체");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPlaces(searchKeyword = "") {
    try {
      setLoading(true);
      setError("");

      const query = searchKeyword
        ? `/api/places?pageNo=1&numOfRows=80&keyword=${encodeURIComponent(
            searchKeyword
          )}`
        : "/api/places?pageNo=1&numOfRows=80";

      const res = await fetch(query);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "데이터를 불러오지 못했습니다.");
      }

      setPlaces(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlaces();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    loadPlaces(keyword.trim());
  }

  const typeList = useMemo(() => {
    const list = places
      .map((place) => getContentTypeName(place.contenttypeid))
      .filter(Boolean);

    return ["전체", ...new Set(list)];
  }, [places]);

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      const typeName = getContentTypeName(place.contenttypeid);
      const matchType = selectedType === "전체" || typeName === selectedType;

      const text = `
        ${place.title || ""}
        ${place.addr1 || ""}
        ${place.addr2 || ""}
        ${place.tel || ""}
      `.toLowerCase();

      const matchKeyword = text.includes(keyword.toLowerCase());

      return matchType && matchKeyword;
    });
  }, [places, keyword, selectedType]);

  function recommendRandomPlace() {
    if (filteredPlaces.length === 0) {
      alert("추천할 장소가 없습니다. 검색어나 필터를 다시 확인해주세요.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * filteredPlaces.length);
    setSelectedPlace(filteredPlaces[randomIndex]);
  }

  return (
    <main>
      <section className="hero">
        <div className="heroTextArea">
          <p className="badge">🐾 한국관광공사 공공데이터 활용</p>

          <h1>댕댕이랑 어디가?</h1>

          <p className="heroText">
            우리 강아지와 함께 갈 수 있는 따뜻한 장소를 찾아보세요.
          </p>
        </div>

        <div className="heroDog">
          <div className="dogFrame">
            <img src="/dog.png" alt="토끼 옷을 입은 귀여운 강아지" />
          </div>

          <div className="bow">🎀</div>
          <div className="heart heart1">♡</div>
          <div className="heart heart2">♡</div>
          <div className="heart heart3">♡</div>
        </div>
      </section>

      <form className="searchBox" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="장소명, 지역명, 키워드를 검색해보세요. 예: 해운대, 카페, 공원"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          {typeList.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <button type="submit" className="searchButton">
          검색
        </button>
      </form>

      <section className="resultInfo">
        <p>
          총 <strong>{filteredPlaces.length}</strong>개의 반려동물 동반 장소가
          검색되었습니다.
        </p>

        <button
          type="button"
          className="recommendButton"
          onClick={recommendRandomPlace}
        >
          오늘 같이 갈 곳 추천받기
        </button>
      </section>

      {loading && (
        <p className="status">반려동물 동반 장소를 불러오는 중입니다...</p>
      )}

      {error && <p className="error">오류: {error}</p>}

      {!loading && !error && (
        <section className="grid">
          {filteredPlaces.map((place) => (
            <PlaceCard
              key={place.contentid}
              place={place}
              onSelect={() => setSelectedPlace(place)}
            />
          ))}
        </section>
      )}

      {selectedPlace && (
        <PlaceModal
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}
    </main>
  );
}

function PlaceCard({ place, onSelect }) {
  const imageUrl = place.firstimage || place.firstimage2;
  const mapUrl = getMapUrl(place);
  const typeName = getContentTypeName(place.contenttypeid);

  return (
    <article className="card">
      <div className="imageWrap">
        {imageUrl ? (
          <img src={imageUrl} alt={place.title || "반려동물 동반 장소 이미지"} />
        ) : (
          <div className="noImage">이미지 없음</div>
        )}
      </div>

      <div className="cardBody">
        <span className="category">
          {getCategoryIcon(typeName)} {typeName}
        </span>

        <h2>{place.title || "이름 없는 장소"}</h2>

        {place.addr1 && (
          <p className="info">
            <strong>주소</strong> {place.addr1}
          </p>
        )}

        {place.tel && (
          <p className="info">
            <strong>연락처</strong> {place.tel}
          </p>
        )}

        <p className="description">
          반려동물과 함께 방문할 수 있는 장소입니다. 방문 전 운영시간과
          동반 조건을 확인해보세요.
        </p>

        <div className="buttons">
          <button type="button" onClick={onSelect}>
            상세보기
          </button>

          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer">
              지도 보기
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function PlaceModal({ place, onClose }) {
  const imageUrl = place.firstimage || place.firstimage2;
  const mapUrl = getMapUrl(place);
  const typeName = getContentTypeName(place.contenttypeid);

  return (
    <div className="modalOverlay" onClick={onClose}>
      <section className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="closeButton" type="button" onClick={onClose}>
          닫기
        </button>

        {imageUrl && (
          <div className="modalImage">
            <img src={imageUrl} alt={place.title || "반려동물 동반 장소 이미지"} />
          </div>
        )}

        <div className="modalBody">
          <span className="category">
            {getCategoryIcon(typeName)} {typeName}
          </span>

          <h2>{place.title || "반려동물 동반 장소"}</h2>

          <div className="detailList">
            {place.addr1 && (
              <p>
                <strong>주소</strong>
                <span>
                  {place.addr1} {place.addr2 || ""}
                </span>
              </p>
            )}

            {place.tel && (
              <p>
                <strong>연락처</strong>
                <span>{place.tel}</span>
              </p>
            )}

            {place.contentid && (
              <p>
                <strong>콘텐츠 ID</strong>
                <span>{place.contentid}</span>
              </p>
            )}

            <p>
              <strong>안내</strong>
              <span>
                반려동물 동반 가능 여부와 세부 조건은 현장 상황에 따라
                달라질 수 있으므로 방문 전 확인이 필요합니다.
              </span>
            </p>
          </div>

          <div className="contentsBox">
            <h3>이용 전 확인할 점</h3>
            <p>
              목줄 착용, 이동장 사용, 실내 동반 가능 여부, 반려동물 크기
              제한 등은 장소마다 다를 수 있습니다. 방문 전 전화 또는 공식
              홈페이지를 통해 최신 정보를 확인해 주세요.
            </p>
          </div>

          <div className="buttons modalButtons">
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                지도에서 보기
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function getContentTypeName(contenttypeid) {
  const types = {
    "12": "관광지",
    "14": "문화시설",
    "15": "축제/공연",
    "28": "레포츠",
    "32": "숙박",
    "38": "쇼핑",
    "39": "음식점",
  };

  return types[String(contenttypeid)] || "기타";
}

function getCategoryIcon(typeName) {
  const icons = {
    관광지: "🌿",
    문화시설: "🎨",
    "축제/공연": "🎪",
    레포츠: "🏃",
    숙박: "🏡",
    쇼핑: "🛍️",
    음식점: "☕",
    기타: "🐾",
  };

  return icons[typeName] || "🐾";
}

function getMapUrl(place) {
  if (place.mapy && place.mapx) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(
      place.title || "반려동물 동반 장소"
    )},${place.mapy},${place.mapx}`;
  }

  if (place.addr1) {
    return `https://map.kakao.com/link/search/${encodeURIComponent(
      place.addr1
    )}`;
  }

  return "";
}
