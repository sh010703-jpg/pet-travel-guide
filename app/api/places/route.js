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

function getServiceKeyForUrl() {
  const rawKey = process.env.TOUR_API_KEY;

  if (!rawKey) {
    return "";
  }

  const trimmedKey = rawKey.trim();

  /*
    공공데이터포털의 Encoding 인증키는 이미 %2F, %2B 같은 문자가 들어있습니다.
    이 경우 encodeURIComponent를 다시 하면 인증키가 망가집니다.
  */
  if (trimmedKey.includes("%")) {
    return trimmedKey;
  }

  /*
    Decoding 인증키를 넣은 경우에는 URL에 들어갈 수 있도록 인코딩합니다.
  */
  return encodeURIComponent(trimmedKey);
}

function makeUrl(baseUrl, serviceKey, pageNo, numOfRows, extraParams = {}) {
  const params = [
    `serviceKey=${serviceKey}`,
    `MobileOS=ETC`,
    `MobileApp=pet-travel-guide`,
    `_type=json`,
    `pageNo=${pageNo}`,
    `numOfRows=${numOfRows}`,
    `arrange=Q`,
  ];

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.push(`${key}=${encodeURIComponent(value)}`);
    }
  });

  return `${baseUrl}?${params.join("&")}`;
}

async function fetchTourApi(url) {
  const response = await fetch(url, {
    cache: "no-store",
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `공공데이터 응답이 JSON이 아닙니다. 인증키 문제일 가능성이 큽니다. 응답 일부: ${text.slice(
        0,
        180
      )}`
    );
  }

  const resultCode = data?.response?.header?.resultCode;
  const resultMsg = data?.response?.header?.resultMsg;

  if (resultCode && resultCode !== "0000") {
    throw new Error(resultMsg || `공공데이터 API 오류 코드: ${resultCode}`);
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
    totalCount: Number(body?.totalCount || itemList.length || 0),
    pageNo: Number(body?.pageNo || 1),
    numOfRows: Number(body?.numOfRows || itemList.length || 0),
  };
}

async function fetchAllPages(createUrl, maxPages = 8) {
  const firstResult = await fetchTourApi(createUrl(1));

  let allItems = [...firstResult.items];

  const totalCount = firstResult.totalCount;
  const numOfRows = firstResult.numOfRows || 100;
  const totalPages = Math.ceil(totalCount / numOfRows);
  const pagesToFetch = Math.min(totalPages, maxPages);

  for (let page = 2; page <= pagesToFetch; page++) {
    const result = await fetchTourApi(createUrl(page));
    allItems = [...allItems, ...result.items];
  }

  return {
    items: allItems,
    totalCount,
    loadedCount: allItems.length,
  };
}

function removeDuplicates(items) {
  const seen = new Set();
  const uniqueItems = [];

  for (const item of items) {
    const key = item.contentid || `${item.title}-${item.addr1}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

function filterExactContentType(items, contentTypeId) {
  if (!contentTypeId) {
    return items;
  }

  return items.filter(
    (item) => String(item.contenttypeid) === String(contentTypeId)
  );
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

async function fetchAreaBasedList({
  serviceKey,
  areaCode,
  contentTypeId,
  keyword,
}) {
  const createUrl = (pageNo) =>
    makeUrl(
      "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2",
      serviceKey,
      pageNo,
      100,
      {
        areaCode,
        contentTypeId,
      }
    );

  const result = await fetchAllPages(createUrl, 8);

  let items = removeDuplicates(result.items);

  if (contentTypeId) {
    items = filterExactContentType(items, contentTypeId);
  }

  items = filterByKeyword(items, keyword);

  return {
    items,
    totalCount: items.length,
    loadedCount: items.length,
  };
}

async function fetchKeywordList({
  serviceKey,
  areaCode,
  contentTypeId,
  keyword,
}) {
  const createUrl = (pageNo) =>
    makeUrl(
      "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2",
      serviceKey,
      pageNo,
      100,
      {
        keyword,
        areaCode,
        contentTypeId,
      }
    );

  const result = await fetchAllPages(createUrl, 8);

  let items = removeDuplicates(result.items);

  if (contentTypeId) {
    items = filterExactContentType(items, contentTypeId);
  }

  return {
    items,
    totalCount: items.length,
    loadedCount: items.length,
  };
}

async function fetchNearby({
  serviceKey,
  mapX,
  mapY,
  radius,
  contentTypeId,
}) {
  const createUrl = (pageNo) =>
    makeUrl(
      "https://apis.data.go.kr/B551011/KorPetTourService2/locationBasedList2",
      serviceKey,
      pageNo,
      100,
      {
        arrange: "E",
        mapX,
        mapY,
        radius,
        contentTypeId,
      }
    );

  const result = await fetchAllPages(createUrl, 5);

  let items = removeDuplicates(result.items);

  if (contentTypeId) {
    items = filterExactContentType(items, contentTypeId);
  }

  return {
    items,
    totalCount: items.length,
    loadedCount: items.length,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const keyword = searchParams.get("keyword") || "";
  const areaCode = searchParams.get("areaCode") || "";
  const contentTypeId = searchParams.get("contentTypeId") || "";

  const mode = searchParams.get("mode") || "";
  const mapX = searchParams.get("mapX") || "";
  const mapY = searchParams.get("mapY") || "";
  const radius = searchParams.get("radius") || "10000";

  const serviceKey = getServiceKeyForUrl();

  if (!serviceKey) {
    return NextResponse.json(
      {
        error: "TOUR_API_KEY가 설정되어 있지 않습니다.",
        detail: "Vercel Environment Variables에 TOUR_API_KEY를 추가해야 합니다.",
      },
      { status: 500 }
    );
  }

  try {
    if (mode === "nearby") {
      if (!mapX || !mapY) {
        return NextResponse.json(
          { error: "현재 위치 좌표가 없습니다." },
          { status: 400 }
        );
      }

      const result = await fetchNearby({
        serviceKey,
        mapX,
        mapY,
        radius,
        contentTypeId,
      });

      return NextResponse.json(result);
    }

    if (keyword.trim()) {
      const result = await fetchKeywordList({
        serviceKey,
        areaCode,
        contentTypeId,
        keyword: keyword.trim(),
      });

      return NextResponse.json(result);
    }

    const result = await fetchAreaBasedList({
      serviceKey,
      areaCode,
      contentTypeId,
      keyword: "",
    });

    return NextResponse.json(result);
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
