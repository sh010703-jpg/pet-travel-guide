import { NextResponse } from "next/server";

const VALID_CONTENT_TYPES = {
  "12": "관광지",
  "14": "문화시설",
  "15": "축제/공연",
  "28": "레포츠",
  "32": "숙박",
  "38": "쇼핑",
  "39": "음식점/카페",
};

const FOOD_CAFE_KEYWORDS = [
  "카페",
  "애견카페",
  "펫카페",
  "반려견카페",
  "반려동물카페",
  "커피",
  "브런치",
  "디저트",
  "베이커리",
  "식당",
  "레스토랑",
  "맛집",
];

const FOOD_CAFE_INCLUDE_WORDS = [
  "카페",
  "커피",
  "coffee",
  "브런치",
  "디저트",
  "베이커리",
  "식당",
  "레스토랑",
  "맛집",
  "펫카페",
  "애견카페",
  "반려견",
  "반려동물",
];

const FOOD_CAFE_EXCLUDE_WORDS = [
  "약국",
  "병원",
  "동물병원",
  "백화점",
  "아울렛",
  "마트",
  "슈퍼",
  "쇼핑몰",
  "시장",
  "펫샵",
  "용품",
  "편집숍",
  "기념품",
];

function makeCommonUrl(baseUrl, serviceKey, pageNo, numOfRows) {
  const url = new URL(baseUrl);

  url.searchParams.append("serviceKey", serviceKey);
  url.searchParams.append("MobileOS", "ETC");
  url.searchParams.append("MobileApp", "pet-travel-guide");
  url.searchParams.append("_type", "json");
  url.searchParams.append("pageNo", String(pageNo));
  url.searchParams.append("numOfRows", String(numOfRows));
  url.searchParams.append("arrange", "Q");

  return url;
}

async function fetchTourApi(url) {
  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `공공데이터 응답이 JSON 형식이 아닙니다. 응답 일부: ${text.slice(
        0,
        120
      )}`
    );
  }

  const resultCode = data?.response?.header?.resultCode;
  const resultMsg = data?.response?.header?.resultMsg;

  if (resultCode && resultCode !== "0000") {
    throw new Error(resultMsg || "공공데이터 API 요청에 실패했습니다.");
  }

  const body = data?.response?.body;
  const items = body?.items?.item;

  let itemList = [];

  if (Array.isArray(items)) {
    itemList = items;
  } else if (items) {
    itemList = [items];
  }

  return {
    items: itemList,
    totalCount: Number(body?.totalCount || 0),
    pageNo: Number(body?.pageNo || 1),
    numOfRows: Number(body?.numOfRows || itemList.length || 0),
  };
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

function getText(item) {
  return `
    ${item.title || ""}
    ${item.addr1 || ""}
    ${item.addr2 || ""}
    ${item.tel || ""}
  `.toLowerCase();
}

function hasFoodCafeWord(item) {
  const text = getText(item);

  return FOOD_CAFE_INCLUDE_WORDS.some((word) =>
    text.includes(word.toLowerCase())
  );
}

function hasExcludeWord(item) {
  const text = getText(item);

  return FOOD_CAFE_EXCLUDE_WORDS.some((word) =>
    text.includes(word.toLowerCase())
  );
}

function filterFoodCafeItems(items) {
  return items.filter((item) => {
    const isOfficialFood = String(item.contenttypeid) === "39";
    const isCafeLike = hasFoodCafeWord(item);
    const isExcluded = hasExcludeWord(item);

    return (isOfficialFood || isCafeLike) && !isExcluded;
  });
}

function filterExactContentType(items, contentTypeId) {
  if (!contentTypeId) {
    return items;
  }

  return items.filter(
    (item) => String(item.contenttypeid) === String(contentTypeId)
  );
}

async function fetchSinglePage({
  serviceKey,
  baseUrl,
  pageNo,
  numOfRows,
  keyword,
  areaCode,
  contentTypeId,
  mode,
  mapX,
  mapY,
  radius,
}) {
  const url = makeCommonUrl(baseUrl, serviceKey, pageNo, numOfRows);

  if (mode === "nearby") {
    url.searchParams.set("arrange", "E");
    url.searchParams.append("mapX", mapX);
    url.searchParams.append("mapY", mapY);
    url.searchParams.append("radius", radius);
  }

  if (keyword) {
    url.searchParams.append("keyword", keyword);
  }

  if (areaCode) {
    url.searchParams.append("areaCode", areaCode);
  }

  if (contentTypeId) {
    url.searchParams.append("contentTypeId", contentTypeId);
  }

  return await fetchTourApi(url);
}

async function fetchFoodCafeExpanded({
  serviceKey,
  areaCode,
  pageNo,
  numOfRows,
}) {
  let allItems = [];

  /*
    1. 공식 음식점/카페 분류 39
  */
  try {
    const officialFoodResult = await fetchSinglePage({
      serviceKey,
      baseUrl:
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2",
      pageNo: 1,
      numOfRows: 100,
      areaCode,
      contentTypeId: "39",
    });

    allItems = [...allItems, ...officialFoodResult.items];
  } catch {
    // 공식 음식점 분류가 실패해도 다음 검색은 계속 진행
  }

  /*
    2. 해당 지역 전체 데이터 중 카페성 단어가 있는 장소 찾기
    예: 부산 전체 데이터 안에서 '카페', '커피', '브런치' 등이 들어간 장소
  */
  try {
    const areaAllResult = await fetchSinglePage({
      serviceKey,
      baseUrl:
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2",
      pageNo: 1,
      numOfRows: 100,
      areaCode,
    });

    const cafeLikeFromArea = areaAllResult.items.filter((item) =>
      hasFoodCafeWord(item)
    );

    allItems = [...allItems, ...cafeLikeFromArea];
  } catch {
    // 지역 전체 조회가 실패해도 키워드 검색은 계속 진행
  }

  /*
    3. 카페 관련 키워드 검색
    여기서는 contentTypeId를 넣지 않습니다.
    그래야 음식점 39가 아닌 다른 분류로 등록된 카페성 장소도 잡힙니다.
  */
  for (const word of FOOD_CAFE_KEYWORDS) {
    try {
      const keywordResult = await fetchSinglePage({
        serviceKey,
        baseUrl:
          "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2",
        pageNo: 1,
        numOfRows: 100,
        keyword: word,
        areaCode,
      });

      allItems = [...allItems, ...keywordResult.items];
    } catch {
      // 특정 키워드가 실패해도 전체 검색은 계속 진행
    }
  }

  /*
    4. 중복 제거 + 제외어 필터
  */
  let items = removeDuplicates(allItems);
  items = filterFoodCafeItems(items);

  /*
    5. 페이지 단위 반환
  */
  const startIndex = (Number(pageNo) - 1) * Number(numOfRows);
  const endIndex = startIndex + Number(numOfRows);
  const pagedItems = items.slice(startIndex, endIndex);

  return {
    items: pagedItems,
    totalCount: items.length,
    pageNo: Number(pageNo),
    numOfRows: Number(numOfRows),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const pageNo = Number(searchParams.get("pageNo") || "1");
  const numOfRows = Number(searchParams.get("numOfRows") || "12");
  const keyword = searchParams.get("keyword") || "";
  const areaCode = searchParams.get("areaCode") || "";
  const contentTypeId = searchParams.get("contentTypeId") || "";

  const mode = searchParams.get("mode") || "";
  const mapX = searchParams.get("mapX") || "";
  const mapY = searchParams.get("mapY") || "";
  const radius = searchParams.get("radius") || "10000";

  const serviceKey = process.env.TOUR_API_KEY;

  if (!serviceKey) {
    return NextResponse.json(
      {
        error: "TOUR_API_KEY가 설정되어 있지 않습니다.",
        detail: "Vercel Environment Variables에 TOUR_API_KEY를 등록해주세요.",
      },
      { status: 500 }
    );
  }

  try {
    /*
      지역 + 음식점/카페 선택 시 확장 검색
      예: 부산 / 음식점·카페
    */
    if (
      contentTypeId === "39" &&
      areaCode &&
      !keyword.trim() &&
      mode !== "nearby"
    ) {
      const result = await fetchFoodCafeExpanded({
        serviceKey,
        areaCode,
        pageNo,
        numOfRows,
      });

      return NextResponse.json(result);
    }

    let baseUrl = "";

    if (mode === "nearby") {
      if (!mapX || !mapY) {
        return NextResponse.json(
          { error: "현재 위치 좌표가 없습니다." },
          { status: 400 }
        );
      }

      baseUrl =
        "https://apis.data.go.kr/B551011/KorPetTourService2/locationBasedList2";
    } else if (keyword.trim()) {
      baseUrl =
        "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2";
    } else {
      baseUrl =
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2";
    }

    const result = await fetchSinglePage({
      serviceKey,
      baseUrl,
      pageNo,
      numOfRows,
      keyword: keyword.trim(),
      areaCode,
      contentTypeId,
      mode,
      mapX,
      mapY,
      radius,
    });

    let items = result.items || [];

    if (contentTypeId && VALID_CONTENT_TYPES[contentTypeId]) {
      items = filterExactContentType(items, contentTypeId);
    }

    return NextResponse.json({
      items,
      totalCount: result.totalCount,
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
