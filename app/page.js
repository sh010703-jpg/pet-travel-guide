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
      <nav className="topNav">
        <div className="logo">
          <span>댕댕이랑</span>
          <strong>어디가?</strong>
        </div>

        <div className="navLinks">
          <a href="#home">홈</a>
          <a href="#places">여행지</a>
          <a href="#walk">산책코스</a>
          <a href="#stay">숙소</a>
          <a href="#pick">오늘추천</a>
        </div>
      </nav>

      <section className="hero" id="home">
        <div className="heroObject">
          <div className="dogHouse">
            <div className="roof"></div>
            <div className="houseBody">
              <div className="door"></div>
            </div>
            <div className="houseBase"></div>
          </div>

          <div className="dogCircle">
            <img
              src="https://images.unsplash.com/photo-1593134257782-e89567b7718a?auto=format&fit=crop&w=900&q=80"
              alt="귀여운 아기 강아지"
            />
          </div>

          <div className="speechBubble">오늘은 어디 갈까?</div>
          <div className="miniIcon iconBag">🎒</div>
          <div className="miniIcon iconBone">🦴</div>
          <div className="miniIcon iconPaw">🐾</div>
        </div>

        <div className="heroTextArea">
          <p className="badge">한국관광공사 공공데이터 활용</p>

          <h1>
            Welcome
            <br />
            to the WORLD
            <br />
            of PET TRIP!
          </h1>

          <h2 className="heroTitle">같이 가개!</h2>

          <p className="heroText">
            반려견과 함께 떠나는 오늘의 나들이.
            <br />
            관광지, 산책길, 숙소, 쇼핑 공간까지
            <br />
            공공데이터로 따뜻하게 찾아드려요.
          </p>
        </div>
      </section>

      <section className="quickPanel">
        <div className="quickItem">
          <span>오늘의 추천</span>
          <strong>반려견 동반 장소</strong>
        </div>

        <div className="quickItem">
          <span>인기 유형</span>
          <strong>관광지 · 숙박 · 쇼핑</strong>
        </div>

        <div className="quickItem">
          <span>이용 안내</span>
          <strong>방문 전 동반 조건 확인</strong>
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
          찾아보기
        </button>
      </form>

      <section className="resultInfo" id="places">
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
        <span className="category">{getCategoryIcon(typeName)} {typeName}</span>
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
          <span className="category">{getCategoryIcon(typeName)} {typeName}</span>
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
    "39": "음식점"
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
    기타: "🐾"
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
