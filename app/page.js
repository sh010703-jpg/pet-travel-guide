import { NextResponse } from "next/server";

const AREA_CODES = [
  "1", // 서울
  "2", // 인천
  "3", // 대전
  "4", // 대구
  "5", // 광주
  "6", // 부산
  "7", // 울산
  "8", // 세종
  "31", // 경기
  "32", // 강원
  "33", // 충북
  "34", // 충남
  "35", // 경북
  "36", // 경남
  "37", // 전북
  "38", // 전남
  "39", // 제주
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const pageNo = searchParams.get("pageNo") || "1";
  const numOfRows = searchParams.get("numOfRows") || "80";
  const keyword = searchParams.get("keyword") || "";
  const areaCode = searchParams.get("areaCode") || "";
  const mapX = searchParams.get("mapX") || "";
  const mapY = searchParams.get("mapY") || "";
  const radius = searchParams.get("radius") || "20000";

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
      - mapX: 경도
      - mapY: 위도
      - radius: 반경 미터 단위
    */
    if (mapX && mapY) {
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

      const response = await fetch(url.toString(), {
        cache: "no-store",
      });

      const data = await response.json();
      const items = normalizeItems(data?.response?.body?.items?.item);

      return NextResponse.json({
        items,
        totalCount: data?.response?.body?.totalCount || items.length,
        pageNo: data?.response?.body?.pageNo || pageNo,
        numOfRows: data?.response?.body?.numOfRows || numOfRows,
        mode: "location",
      });
    }

    /*
      2. 검색어가 있을 때
      - keyword 검색
      - 지역 선택값이 있으면 해당 지역 안에서 검색
      - 지역 선택값이 없으면 전국 검색
    */
    if (keyword) {
      const url = new URL(
        "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2"
      );

      url.searchParams.append("serviceKey", serviceKey);
      url.searchParams.append("MobileOS", "ETC");
      url.searchParams.append("MobileApp", "pet-travel-guide");
      url.searchParams.append("_type", "json");
      url.searchParams.append("pageNo", pageNo);
      url.searchParams.append("numOfRows", numOfRows);
      url.searchParams.append("arrange", "Q");
      url.searchParams.append("keyword", keyword);

      if (areaCode) {
        url.searchParams.append("areaCode", areaCode);
      }

      const response = await fetch(url.toString(), {
        cache: "no-store",
      });

      const data = await response.json();
      const items = normalizeItems(data?.response?.body?.items?.item);

      return NextResponse.json({
        items,
        totalCount: data?.response?.body?.totalCount || items.length,
        pageNo: data?.response?.body?.pageNo || pageNo,
        numOfRows: data?.response?.body?.numOfRows || numOfRows,
        mode: "keyword",
      });
    }

    /*
      3. 지역을 선택했지만 검색어는 없을 때
      - 선택한 지역의 반려동물 동반 장소 조회
    */
    if (areaCode) {
      const url = new URL(
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2"
      );

      url.searchParams.append("serviceKey", serviceKey);
      url.searchParams.append("MobileOS", "ETC");
      url.searchParams.append("MobileApp", "pet-travel-guide");
      url.searchParams.append("_type", "json");
      url.searchParams.append("pageNo", pageNo);
      url.searchParams.append("numOfRows", numOfRows);
      url.searchParams.append("arrange", "Q");
      url.searchParams.append("areaCode", areaCode);

      const response = await fetch(url.toString(), {
        cache: "no-store",
      });

      const data = await response.json();
      const items = normalizeItems(data?.response?.body?.items?.item);

      return NextResponse.json({
        items,
        totalCount: data?.response?.body?.totalCount || items.length,
        pageNo: data?.response?.body?.pageNo || pageNo,
        numOfRows: data?.response?.body?.numOfRows || numOfRows,
        mode: "area",
      });
    }

    /*
      4. 검색어도 없고 지역 선택도 없을 때
      - 전국 지역에서 조금씩 가져오기
      - 서울만 몰리지 않도록 전체 지역코드를 순회
    */
    const requests = AREA_CODES.map(async (code) => {
      const url = new URL(
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2"
      );

      url.searchParams.append("serviceKey", serviceKey);
      url.searchParams.append("MobileOS", "ETC");
      url.searchParams.append("MobileApp", "pet-travel-guide");
      url.searchParams.append("_type", "json");
      url.searchParams.append("pageNo", "1");
      url.searchParams.append("numOfRows", "8");
      url.searchParams.append("arrange", "Q");
      url.searchParams.append("areaCode", code);

      const response = await fetch(url.toString(), {
        cache: "no-store",
      });

      const data = await response.json();
      return normalizeItems(data?.response?.body?.items?.item);
    });

    const results = await Promise.all(requests);
    const mergedItems = results.flat();
    const uniqueItems = removeDuplicateItems(mergedItems);

    return NextResponse.json({
      items: uniqueItems,
      totalCount: uniqueItems.length,
      pageNo,
      numOfRows,
      mode: "national",
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

function normalizeItems(items) {
  if (Array.isArray(items)) {
    return items;
  }

  if (items) {
    return [items];
  }

  return [];
}

function removeDuplicateItems(items) {
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
