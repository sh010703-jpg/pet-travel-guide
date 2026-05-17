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

function filterBadPlaces(items) {
  const excludeWords = [
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

  return items.filter((item) => {
    const text = getText(item);

    return !excludeWords.some((word) => text.includes(word.toLowerCase()));
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

/*
  음식점/카페 전용:
  contentTypeId=39로 묶지 않고, 카페 키워드 검색을 우선 사용합니다.
  어제 카페 2~3개 보였던 방식에 가장 가깝습니다.
*/
async function fetchCafeSearch({
  serviceKey,
  areaCode,
  pageNo,
  numOfRows,
}) {
  const keywords = ["카페", "애견카페", "펫카페", "커피", "브런치"];

  let allItems = [];

  for (const keyword of keywords) {
    try {
      const result = await fetchSinglePage({
        serviceKey,
        baseUrl:
          "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2",
        pageNo: 1,
        numOfRows: 100,
        keyword,
        areaCode,
      });

      allItems = [...allItems, ...result.items];
    } catch {
      // 특정 키워드가 실패해도 전체는 계속 진행
    }
  }

  let items = removeDuplicates(allItems);
  items = filterBadPlaces(items);

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
      핵심 수정:
      지역 + 음식점/카페 선택 시
      contentTypeId=39가 아니라 카페 키워드 검색으로 처리합니다.
    */
    if (
      contentTypeId === "39" &&
      areaCode &&
      !keyword.trim() &&
      mode !== "nearby"
    ) {
      const result = await fetchCafeSearch({
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
