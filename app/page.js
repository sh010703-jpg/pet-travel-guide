import { NextResponse } from "next/server";

const AREA_CODES = [
  "1",  // 서울
  "2",  // 인천
  "3",  // 대전
  "4",  // 대구
  "5",  // 광주
  "6",  // 부산
  "7",  // 울산
  "8",  // 세종
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

  const serviceKey = process.env.TOUR_API_KEY;

  if (!serviceKey) {
    return NextResponse.json(
      { error: "TOUR_API_KEY가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  try {
    let allItems = [];

    /*
      1. 검색어가 있을 때
      - searchKeyword2 사용
      - areaCode를 넣지 않으면 전국 키워드 검색
      - 예: 부산, 제주, 강릉, 해운대, 카페 등
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

      const response = await fetch(url.toString(), {
        cache: "no-store",
      });

      const data = await response.json();
      const items = data?.response?.body?.items?.item;

      if (Array.isArray(items)) {
        allItems = items;
      } else if (items) {
        allItems = [items];
      }

      return NextResponse.json({
        items: allItems,
        totalCount: data?.response?.body?.totalCount || allItems.length,
        pageNo: data?.response?.body?.pageNo || pageNo,
        numOfRows: data?.response?.body?.numOfRows || numOfRows,
      });
    }

    /*
      2. 검색어가 없을 때
      - 전국 지역코드를 하나씩 돌면서 가져옴
      - 서울만 몰리지 않도록 각 지역에서 조금씩 가져옴
    */
    const requests = AREA_CODES.map(async (areaCode) => {
      const url = new URL(
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2"
      );

      url.searchParams.append("serviceKey", serviceKey);
      url.searchParams.append("MobileOS", "ETC");
      url.searchParams.append("MobileApp", "pet-travel-guide");
      url.searchParams.append("_type", "json");
      url.searchParams.append("pageNo", "1");
      url.searchParams.append("numOfRows", "12");
      url.searchParams.append("arrange", "Q");
      url.searchParams.append("areaCode", areaCode);

      const response = await fetch(url.toString(), {
        cache: "no-store",
      });

      const data = await response.json();
      const items = data?.response?.body?.items?.item;

      if (Array.isArray(items)) {
        return items;
      }

      if (items) {
        return [items];
      }

      return [];
    });

    const results = await Promise.all(requests);

    allItems = results.flat();

    /*
      중복 제거
      같은 장소가 여러 번 들어오는 것을 방지
    */
    const uniqueItems = [];
    const seen = new Set();

    for (const item of allItems) {
      const key = item.contentid || `${item.title}-${item.addr1}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    }

    return NextResponse.json({
      items: uniqueItems,
      totalCount: uniqueItems.length,
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
