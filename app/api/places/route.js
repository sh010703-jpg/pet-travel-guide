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
      `공공데이터 응답이 JSON이 아닙니다. 응답 일부: ${text.slice(0, 120)}`
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
    totalCount: Number(body?.totalCount || itemList.length || 0),
    pageNo: Number(body?.pageNo || 1),
    numOfRows: Number(body?.numOfRows || itemList.length || 0),
  };
}

async function fetchAllPages(createUrl, maxPages = 50) {
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

function filterExactContentType(items, contentTypeId) {
  if (!contentTypeId) {
    return items;
  }

  return items.filter(
    (item) => String(item.contenttypeid) === String(contentTypeId)
  );
}

function filterByKeywordInResult(items, keyword) {
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

async function fetchByContentType({
  serviceKey,
  areaCode,
  contentTypeId,
  keyword,
  numOfRows,
}) {
  const createUrl = (pageNo) => {
    const url = makeCommonUrl(
      "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2",
      serviceKey,
      pageNo,
      numOfRows
    );

    if (areaCode) {
      url.searchParams.append("areaCode", areaCode);
    }

    url.searchParams.append("contentTypeId", contentTypeId);

    return url;
  };

  const result = await fetchAllPages(createUrl, 50);

  let items = removeDuplicates(result.items);

  items = filterExactContentType(items, contentTypeId);
  items = filterByKeywordInResult(items, keyword);

  return {
    items,
    totalCount: items.length,
    loadedCount: items.length,
  };
}

async function fetchAreaOnly({ serviceKey, areaCode, numOfRows }) {
  if (areaCode) {
    const createUrl = (pageNo) => {
      const url = makeCommonUrl(
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2",
        serviceKey,
        pageNo,
        numOfRows
      );

      url.searchParams.append("areaCode", areaCode);

      return url;
    };

    const result = await fetchAllPages(createUrl, 50);
    const items = removeDuplicates(result.items);

    return {
      items,
      totalCount: items.length,
      loadedCount: items.length,
    };
  }

  /*
    전국 전체:
    17개 지역을 각각 조회하되, 한 지역이 실패해도 전체가 죽지 않도록 allSettled 사용
  */
  let allItems = [];

  const requests = AREA_CODES.map(async (code) => {
    const createUrl = (pageNo) => {
      const url = makeCommonUrl(
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2",
        serviceKey,
        pageNo,
        numOfRows
      );

      url.searchParams.append("areaCode", code);

      return url;
    };

    const result = await fetchAllPages(createUrl, 50);
    return result.items;
  });

  const results = await Promise.allSettled(requests);

  const failedReasons = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems = [...allItems, ...result.value];
    } else {
      failedReasons.push(result.reason?.message || "알 수 없는 지역 조회 오류");
    }
  }

  const items = removeDuplicates(allItems);

  if (items.length === 0 && failedReasons.length > 0) {
    throw new Error(failedReasons[0]);
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
  numOfRows,
}) {
  const createUrl = (pageNo) => {
    const url = makeCommonUrl(
      "https://apis.data.go.kr/B551011/KorPetTourService2/locationBasedList2",
      serviceKey,
      pageNo,
      numOfRows
    );

    url.searchParams.set("arrange", "E");
    url.searchParams.append("mapX", mapX);
    url.searchParams.append("mapY", mapY);
    url.searchParams.append("radius", radius);

    if (contentTypeId) {
      url.searchParams.append("contentTypeId", contentTypeId);
    }

    return url;
  };

  const result = await fetchAllPages(createUrl, 20);

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

  const serviceKey = process.env.TOUR_API_KEY;
  const numOfRows = 100;

  if (!serviceKey) {
    return NextResponse.json(
      { error: "TOUR_API_KEY가 설정되어 있지 않습니다." },
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
        numOfRows,
      });

      return NextResponse.json(result);
    }

    if (contentTypeId && VALID_CONTENT_TYPES[contentTypeId]) {
      const result = await fetchByContentType({
        serviceKey,
        areaCode,
        contentTypeId,
        keyword,
        numOfRows,
      });

      return NextResponse.json(result);
    }

    if (keyword) {
      const createUrl = (pageNo) => {
        const url = makeCommonUrl(
          "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2",
          serviceKey,
          pageNo,
          numOfRows
        );

        url.searchParams.append("keyword", keyword);

        if (areaCode) {
          url.searchParams.append("areaCode", areaCode);
        }

        return url;
      };

      const result = await fetchAllPages(createUrl, 30);
      const items = removeDuplicates(result.items);

      return NextResponse.json({
        items,
        totalCount: items.length,
        loadedCount: items.length,
      });
    }

    const result = await fetchAreaOnly({
      serviceKey,
      areaCode,
      numOfRows,
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
