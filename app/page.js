"use client";

import { useEffect, useMemo, useState } from "react";
import "./globals.css";

const AREA_OPTIONS = [
  { label: "전국", value: "" },
  { label: "서울", value: "1" },
  { label: "인천", value: "2" },
  { label: "대전", value: "3" },
  { label: "대구", value: "4" },
  { label: "광주", value: "5" },
  { label: "부산", value: "6" },
  { label: "울산", value: "7" },
  { label: "세종", value: "8" },
  { label: "경기", value: "31" },
  { label: "강원", value: "32" },
  { label: "충북", value: "33" },
  { label: "충남", value: "34" },
  { label: "경북", value: "35" },
  { label: "경남", value: "36" },
  { label: "전북", value: "37" },
  { label: "전남", value: "38" },
  { label: "제주", value: "39" },
];

export default function Home() {
  const [places, setPlaces] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedType, setSelectedType] = useState("전체");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [modeText, setModeText] = useState("전국");

  async function loadPlaces(searchKeyword = keyword, areaCode = selectedArea) {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("pageNo", "1");
      params.set("numOfRows", "100");

      if (searchKeyword.trim()) {
        params.set("keyword", searchKeyword.trim());
      }

      if (areaCode) {
        params.set("areaCode", areaCode);
      }

      const res = await fetch(`/api/places?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "데이터를 불러오지 못했습니다.");
      }

      setPlaces(data.items || []);
      setModeText(getModeText(searchKeyword, areaCode));
    } catch (err) {
      setError(err.message);
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlaces("", "");
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    loadPlaces(keyword, selectedArea);
  }

  function handleAreaChange(e) {
    const areaCode = e.target.value;
    setSelectedArea(areaCode);
    setSelectedType("전체");
    loadPlaces(keyword, areaCode);
  }

  function findNearbyPlaces() {
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setLocationLoading(true);
    setLoading(true);
    setError("");
    setSelectedType("전체");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          const params = new URLSearchParams();
          params.set("pageNo", "1");
          params.set("numOfRows", "100");
          params.set("mapX", String(longitude));
          params.set("mapY", String(latitude));
          params.set("radius", "20000");

          const res = await fetch(`/api/places?${params.toString()}`);
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || "위치 기반 데이터를 불러오지 못했습니다.");
          }

          setPlaces(data.items || []);
          setModeText("내 위치 기준 가까운 곳");
        } catch (err) {
          setError(err.message);
          setPlaces([]);
        } finally {
          setLoading(false);
          setLocationLoading(false);
        }
      },
      () => {
        setError("현재 위치 사용이 허용되지 않았습니다.");
        setLoading(false);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
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

      return matchType;
    });
  }, [places, selectedType]);

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
        <div className="floatingHeart heartA">♡</div>
        <div className="floatingHeart heartB">♡</div>
        <div className="floatingHeart heartC">♡</div>
        <div className="floatingHeart heartD">✦</div>
        <div className="floatingHeart heartE">♡</div>
        <div className="floatingHeart heartF">♡</div>

        <div className="heroDog">
          <img
            src="/dog-badge.png"
            alt="동그라미 안에 들어간 귀여운 강아지"
            className="dogBadgeImage"
          />
        </div>

        <div className="heroTextArea">
          <p className="badge">🐾 한국관광공사 공공데이터 활용</p>

          <h1>댕댕이랑 어디가?</h1>

          <p className="heroText">
            우리 강아지와 함께 갈 수 있는 따뜻한 장소를 찾아보세요.
          </p>
        </div>
      </section>

      <form className="searchBox" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="지역명이나 장소명을 검색해보세요. 예: 서울, 부산, 제주, 강릉, 카페, 공원"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <select value={selectedArea} onChange={handleAreaChange}>
          {AREA_OPTIONS.map((area) => (
            <option key={area.label} value={area.value}>
              {area.label}
            </option>
          ))}
        </select>

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

      <section className="actionArea">
        <button
          type="button"
          className="locationButton"
          onClick={findNearbyPlaces}
          disabled={locationLoading}
        >
          {locationLoading ? "위치 확인 중..." : "내 위치에서 가까운 곳 찾기"}
        </button>

        <button
          type="button"
          className="recommendButton"
          onClick={recommendRandomPlace}
        >
          오늘 같이 갈 곳 추천받기
        </button>
      </section>

      <section className="resultInfo">
        <p>
          <span className="modeText">{modeText}</span> 기준으로 총{" "}
          <strong>{filteredPlaces.length}</strong>개의 반려동물 동반 장소가
          검색되었습니다.
        </p>
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

function getModeText(keyword, areaCode) {
  const area = AREA_OPTIONS.find((item) => item.value === areaCode);
  const areaLabel = area?.label || "전국";

  if (keyword?.trim() && areaLabel !== "전국") {
    return `${areaLabel} · ${keyword.trim()}`;
  }

  if (keyword?.trim()) {
    return `전국 · ${keyword.trim()}`;
  }

  return areaLabel;
}
