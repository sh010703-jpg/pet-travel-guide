"use client";

import { useMemo, useState } from "react";
import "./globals.css";

const AREA_LIST = [
  { name: "전국", code: "" },
  { name: "서울", code: "1" },
  { name: "인천", code: "2" },
  { name: "대전", code: "3" },
  { name: "대구", code: "4" },
  { name: "광주", code: "5" },
  { name: "부산", code: "6" },
  { name: "울산", code: "7" },
  { name: "세종", code: "8" },
  { name: "경기", code: "31" },
  { name: "강원", code: "32" },
  { name: "충북", code: "33" },
  { name: "충남", code: "34" },
  { name: "경북", code: "35" },
  { name: "경남", code: "36" },
  { name: "전북", code: "37" },
  { name: "전남", code: "38" },
  { name: "제주", code: "39" },
];

const TYPE_LIST = [
  { name: "전체", code: "" },
  { name: "관광지", code: "12" },
  { name: "문화시설", code: "14" },
  { name: "축제/공연", code: "15" },
  { name: "레포츠", code: "28" },
  { name: "숙박", code: "32" },
  { name: "쇼핑", code: "38" },
  { name: "음식점/카페", code: "39" },
];

const PAGE_SIZE = 12;

export default function Home() {
  const [places, setPlaces] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);

  async function loadPlaces({
    searchKeyword = keyword,
    areaCode = selectedArea,
    typeCode = selectedType,
    page = 1,
    mode = "",
    position = currentPosition,
  } = {}) {
    try {
      setLoading(true);
      setError("");
      setHasSearched(true);

      const params = new URLSearchParams();
      params.append("pageNo", String(page));
      params.append("numOfRows", String(PAGE_SIZE));

      if (searchKeyword.trim()) {
        params.append("keyword", searchKeyword.trim());
      }

      if (areaCode) {
        params.append("areaCode", areaCode);
      }

      if (typeCode) {
        params.append("contentTypeId", typeCode);
      }

      if (mode === "nearby") {
        if (!position) {
          throw new Error("현재 위치 정보가 없습니다.");
        }

        params.append("mode", "nearby");
        params.append("mapX", String(position.longitude));
        params.append("mapY", String(position.latitude));
        params.append("radius", "10000");
      }

      const res = await fetch(`/api/places?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.detail || data.error || "데이터를 불러오지 못했습니다."
        );
      }

      setPlaces(data.items || []);
      setTotalCount(data.totalCount || 0);
      setCurrentPage(page);
    } catch (err) {
      setPlaces([]);
      setTotalCount(0);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    setNearbyMode(false);

    loadPlaces({
      searchKeyword: keyword,
      areaCode: selectedArea,
      typeCode: selectedType,
      page: 1,
      mode: "",
    });
  }

  function handleAreaChange(e) {
    const areaCode = e.target.value;
    setSelectedArea(areaCode);
    setNearbyMode(false);

    loadPlaces({
      searchKeyword: keyword,
      areaCode,
      typeCode: selectedType,
      page: 1,
      mode: "",
    });
  }

  function handleTypeChange(e) {
    const typeCode = e.target.value;
    setSelectedType(typeCode);
    setNearbyMode(false);

    loadPlaces({
      searchKeyword: keyword,
      areaCode: selectedArea,
      typeCode,
      page: 1,
      mode: "",
    });
  }

  async function findNearbyPlaces() {
    if (!navigator.geolocation) {
      alert("현재 브라우저에서는 위치 정보를 사용할 수 없습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setCurrentPosition(coords);
        setNearbyMode(true);
        setKeyword("");
        setSelectedArea("");

        loadPlaces({
          searchKeyword: "",
          areaCode: "",
          typeCode: selectedType,
          page: 1,
          mode: "nearby",
          position: coords,
        });
      },
      () => {
        alert(
          "위치 권한이 허용되지 않았습니다. 브라우저에서 위치 권한을 허용해주세요."
        );
      }
    );
  }

  function goToPage(page) {
    if (page < 1 || page > totalPages) {
      return;
    }

    if (nearbyMode) {
      loadPlaces({
        searchKeyword: "",
        areaCode: "",
        typeCode: selectedType,
        page,
        mode: "nearby",
        position: currentPosition,
      });
    } else {
      loadPlaces({
        searchKeyword: keyword,
        areaCode: selectedArea,
        typeCode: selectedType,
        page,
        mode: "",
      });
    }

    setTimeout(() => {
      const resultSection = document.querySelector(".resultInfo");
      if (resultSection) {
        resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
  }

  function getVisiblePageNumbers() {
    const pages = [];
    const maxVisible = 5;

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let page = start; page <= end; page++) {
      pages.push(page);
    }

    return pages;
  }

  const selectedAreaName =
    AREA_LIST.find((area) => area.code === selectedArea)?.name || "전국";

  const selectedTypeName =
    TYPE_LIST.find((type) => type.code === selectedType)?.name || "전체";

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const startNumber =
    totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;

  const endNumber = Math.min(currentPage * PAGE_SIZE, totalCount);

  const visiblePages = useMemo(() => getVisiblePageNumbers(), [
    currentPage,
    totalPages,
  ]);

  function recommendRandomPlace() {
    if (places.length === 0) {
      alert("추천할 장소가 없습니다. 검색어나 필터를 다시 확인해주세요.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * places.length);
    setSelectedPlace(places[randomIndex]);
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
            우리 강아지와 함께 갈 수 있는 전국의 따뜻한 장소를 찾아보세요.
          </p>
        </div>
      </section>

      <form className="searchBox searchBoxWide" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="지역명이나 장소명을 검색해보세요. 예: 서울, 부산, 제주, 강릉, 카페, 공원"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <select value={selectedArea} onChange={handleAreaChange}>
          {AREA_LIST.map((area) => (
            <option key={area.name} value={area.code}>
              {area.name}
            </option>
          ))}
        </select>

        <select value={selectedType} onChange={handleTypeChange}>
          {TYPE_LIST.map((type) => (
            <option key={type.name} value={type.code}>
              {type.name}
            </option>
          ))}
        </select>

        <button type="submit" className="searchButton">
          검색
        </button>
      </form>

      <section className="resultInfo">
        <div>
          {!hasSearched ? (
            <p
              style={{
                fontSize: "22px",
                fontWeight: "800",
                color: "#7b6365",
                lineHeight: "1.7",
              }}
            >
              지역이나 장소명을 선택한 뒤 검색해 보세요.
            </p>
          ) : (
            <>
              <p>
                <strong>{nearbyMode ? "내 위치 기준" : selectedAreaName}</strong>{" "}
                / <strong>{selectedTypeName}</strong> 기준으로 총{" "}
                <strong>{totalCount}</strong>개의 반려동물 동반 장소가
                검색되었습니다.
              </p>

              {!loading && !error && totalCount > 0 && (
                <p className="pageSummary">
                  현재 <strong>{startNumber}</strong>번부터{" "}
                  <strong>{endNumber}</strong>번까지 표시 중입니다. (
                  {currentPage} / {totalPages}페이지)
                </p>
              )}
            </>
          )}
        </div>

        <div className="resultButtons">
          <button
            type="button"
            className="nearbyButton"
            onClick={findNearbyPlaces}
          >
            내 위치에서 가까운 곳
          </button>

          <button
            type="button"
            className="recommendButton"
            onClick={recommendRandomPlace}
          >
            오늘 같이 갈 곳 추천받기
          </button>
        </div>
      </section>

      {loading && (
        <p className="status">반려동물 동반 장소를 불러오는 중입니다...</p>
      )}

      {error && <p className="error">오류: {error}</p>}

      {!loading && !error && hasSearched && places.length === 0 && (
        <p className="status">
          조건에 맞는 장소가 없습니다. 지역이나 유형을 바꿔보세요.
        </p>
      )}

      {!loading && !error && places.length > 0 && (
        <>
          <section className="grid">
            {places.map((place) => (
              <PlaceCard
                key={place.contentid}
                place={place}
                onSelect={() => setSelectedPlace(place)}
              />
            ))}
          </section>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            visiblePages={visiblePages}
            onPageChange={goToPage}
          />
        </>
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

function Pagination({ currentPage, totalPages, visiblePages, onPageChange }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="페이지 이동">
      <button
        type="button"
        className="pageMoveButton"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        이전
      </button>

      {visiblePages[0] > 1 && (
        <>
          <button
            type="button"
            className="pageNumberButton"
            onClick={() => onPageChange(1)}
          >
            1
          </button>
          <span className="pageDots">...</span>
        </>
      )}

      {visiblePages.map((page) => (
        <button
          key={page}
          type="button"
          className={
            page === currentPage
              ? "pageNumberButton activePage"
              : "pageNumberButton"
          }
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}

      {visiblePages[visiblePages.length - 1] < totalPages && (
        <>
          <span className="pageDots">...</span>
          <button
            type="button"
            className="pageNumberButton"
            onClick={() => onPageChange(totalPages)}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        type="button"
        className="pageMoveButton"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        다음
      </button>
    </nav>
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

        {place.dist && (
          <p className="info">
            <strong>거리</strong> 약 {Number(place.dist).toLocaleString()}m
          </p>
        )}

        <p className="description">
          반려동물과 함께 방문할 수 있는 장소입니다. 방문 전 운영시간과 동반
          조건을 확인해보세요.
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

            {place.dist && (
              <p>
                <strong>거리</strong>
                <span>약 {Number(place.dist).toLocaleString()}m</span>
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
                반려동물 동반 가능 여부와 세부 조건은 현장 상황에 따라 달라질 수
                있으므로 방문 전 확인이 필요합니다.
              </span>
            </p>
          </div>

          <div className="contentsBox">
            <h3>이용 전 확인할 점</h3>
            <p>
              목줄 착용, 이동장 사용, 실내 동반 가능 여부, 반려동물 크기 제한
              등은 장소마다 다를 수 있습니다. 방문 전 전화 또는 공식 홈페이지를
              통해 최신 정보를 확인해 주세요.
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
    "39": "음식점/카페",
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
    "음식점/카페": "☕",
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
