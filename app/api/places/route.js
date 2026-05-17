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
      `공공데이터 응답이 JSON 형식이 아닙니다. 응답 일부: ${text.slice(0, 120)}`
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
    pageNo: Number(body?.pageNo || pageNo || 1),
    numOfRows: Number(body?.numOfRows || itemList.length || 0),
  };
}

function filterExactContentType(items, contentTypeId) {
  if (!contentTypeId) {
    return items;
  }

  return items.filter(
    (item) => String(item.contenttypeid) === String(contentTypeId)
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const pageNo = searchParams.get("pageNo") || "1";
  const numOfRows = searchParams.get("numOfRows") || "12";
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

    const url = makeCommonUrl(baseUrl, serviceKey, pageNo, numOfRows);

    if (mode === "nearby") {
      url.searchParams.set("arrange", "E");
      url.searchParams.append("mapX", mapX);
      url.searchParams.append("mapY", mapY);
      url.searchParams.append("radius", radius);
    }

    if (keyword.trim()) {
      url.searchParams.append("keyword", keyword.trim());
    }

    if (areaCode) {
      url.searchParams.append("areaCode", areaCode);
    }

    if (contentTypeId && VALID_CONTENT_TYPES[contentTypeId]) {
      url.searchParams.append("contentTypeId", contentTypeId);
    }

    const result = await fetchTourApi(url);

    let items = result.items || [];

    if (contentTypeId && VALID_CONTENT_TYPES[contentTypeId]) {
      items = filterExactContentType(items, contentTypeId);
    }

    return NextResponse.json({
      items,
      totalCount: result.totalCount,
      pageNo: Number(pageNo),
      numOfRows: Number(numOfRows),
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
