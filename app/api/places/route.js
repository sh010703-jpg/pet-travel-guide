import { NextResponse } from "next/server";

async function fetchTourApi(url) {
  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  const data = await response.json();

  const resultCode = data?.response?.header?.resultCode;
  const resultMsg = data?.response?.header?.resultMsg;

  if (resultCode && resultCode !== "0000") {
    throw new Error(resultMsg || "공공데이터 API 요청에 실패했습니다.");
  }

  const items = data?.response?.body?.items?.item;

  if (Array.isArray(items)) {
    return items;
  }

  if (items) {
    return [items];
  }

  return [];
}

function removeDuplicates(items) {
  const uniqueItems = [];
  const seen = new Set();

  for (const item of items) {
    const key = item.contentid || `${item.title}-${item.addr1}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

function filterByKeyword(items, keyword) {
  if (!keyword) {
    return items;
  }

  const searchText = keyword.toLowerCase();

  return items.filter((item) => {
    const text = `
      ${item.title || ""}
      ${item.addr1 || ""}
      ${item.addr2 || ""}
      ${item.tel || ""}
    `.toLowerCase();

    return text.includes(searchText);
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const pageNo = searchParams.get("pageNo") || "1";
  const numOfRows = searchParams.get("numOfRows") || "80";
  const keyword = searchParams.get("keyword") || "";
  const areaCode = searchParams.get("areaCode") || "";
  const contentTypeId = searchParams.get("contentTypeId") || "";
  const petCafe = searchParams.get("petCafe") || "";

  const mode = searchParams.get("mode") || "";
  const mapX = searchParams.get("mapX") || "";
  const mapY = searchParams.get("mapY") || "";
  const radius = searchParams.get("radius") || "10000";

  const serviceKey = process.env.TOUR_API_KEY;

  if (!serviceKey) {
    return NextResponse.json(
      { error: "TOUR_API_KEY가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  try {
    /*
      1. 내 위치 기반 조회
    */
    if (mode === "nearby") {
      if (!mapX || !mapY) {
        return NextResponse.json(
          { error: "현재 위치 좌표가 없습니다." },
          { status: 400 }
        );
      }

      const url = new URL(
        "https://apis.data.go.kr/B551011/KorPetTourService2/locationBasedList2"
      );

      url.searchParams.append("serviceKey", serviceKey);
      url.searchParams.append("MobileOS", "ETC");
      url.searchParams.append("MobileApp", "pet-travel-guide");
      url.searchParams.append("_type", "json");
      url.searchParams.append("pageNo", pageNo);
      url.searchParams.append("numOfRows", numOfRows);
      url.searchParams.append("arrange", "E");
      url.searchParams.append("mapX", mapX);
      url.searchParams.append("mapY", mapY);
      url.searchParams.append("radius", radius);

      if (contentTypeId) {
        url.searchParams.append("contentTypeId", contentTypeId);
      }

      const items = await fetchTourApi(url);

      return NextResponse.json({
        items: removeDuplicates(items),
        totalCount: items.length,
        pageNo,
        numOfRows,
      });
    }

    /*
      2. 카페/애견카페 조회
      - 음식점 39만 보지 않고, 키워드 "카페", "애견카페"를 함께 검색
      - 지역 선택값이 있으면 areaCode도 같이 전달
    */
    if (petCafe === "1") {
      const cafeKeywords = ["애견카페", "카페"];
      let allItems = [];

      for (const cafeKeyword of cafeKeywords) {
        const url = new URL(
          "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2"
        );

        url.searchParams.append("serviceKey", serviceKey);
        url.searchParams.append("MobileOS", "ETC");
        url.searchParams.append("MobileApp", "pet-travel-guide");
        url.searchParams.append("_type", "json");
        url.searchParams.append("pageNo", "1");
        url.searchParams.append("numOfRows", numOfRows);
        url.searchParams.append("arrange", "Q");
        url.searchParams.append("keyword", cafeKeyword);

        if (areaCode) {
          url.searchParams.append("areaCode", areaCode);
        }

        const items = await fetchTourApi(url);
        allItems = [...allItems, ...items];
      }

      let uniqueItems = removeDuplicates(allItems);

      /*
        검색창에 해운대, 광안리, 서면 같은 키워드를 추가로 넣었을 때
        카페 결과 안에서 한 번 더 걸러줌
      */
      uniqueItems = filterByKeyword(uniqueItems, keyword);

      return NextResponse.json({
        items: uniqueItems,
        totalCount: uniqueItems.length,
        pageNo,
        numOfRows,
      });
    }

    /*
      3. 일반 검색
      - 검색어가 있으면 searchKeyword2
      - 검색어가 없으면 areaBasedList2
      - 지역과 유형을 API에 같이 전달
    */
    const baseUrl = keyword
      ? "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2"
      : "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2";

    const url = new URL(baseUrl);

    url.searchParams.append("serviceKey", serviceKey);
    url.searchParams.append("MobileOS", "ETC");
    url.searchParams.append("MobileApp", "pet-travel-guide");
    url.searchParams.append("_type", "json");
    url.searchParams.append("pageNo", pageNo);
    url.searchParams.append("numOfRows", numOfRows);
    url.searchParams.append("arrange", "Q");

    if (keyword) {
      url.searchParams.append("keyword", keyword);
    }

    if (areaCode) {
      url.searchParams.append("areaCode", areaCode);
    }

    if (contentTypeId) {
      url.searchParams.append("contentTypeId", contentTypeId);
    }

    const items = await fetchTourApi(url);

    return NextResponse.json({
      items: removeDuplicates(items),
      totalCount: items.length,
      pageNo,
      numOfRows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "공공데이터를 불러오는 중 오류가 발생했습니다.",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
