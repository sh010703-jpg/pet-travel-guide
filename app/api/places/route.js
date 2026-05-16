import { NextResponse } from "next/server";

const AREA_NAME_MAP = {
  "1": "서울",
  "2": "인천",
  "3": "대전",
  "4": "대구",
  "5": "광주",
  "6": "부산",
  "7": "울산",
  "8": "세종",
  "31": "경기",
  "32": "강원",
  "33": "충북",
  "34": "충남",
  "35": "경북",
  "36": "경남",
  "37": "전북",
  "38": "전남",
  "39": "제주",
};

const AREA_CODES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
];

/*
  한국관광공사 관광정보 contentTypeId 기준
  12 관광지
  14 문화시설
  15 축제/공연
  28 레포츠
  32 숙박
  38 쇼핑
  39 음식점

  문제는 실제 데이터가 항상 정확한 분류에만 들어가 있지 않기 때문에
  각 유형별로 관련 키워드도 함께 검색합니다.
*/
const TYPE_KEYWORDS = {
  "12": [
    "관광지",
    "여행지",
    "공원",
    "해변",
    "해수욕장",
    "산책",
    "산책로",
    "둘레길",
    "반려견동반",
    "애견동반",
    "반려동물동반",
  ],
  "14": [
    "문화시설",
    "미술관",
    "박물관",
    "전시",
    "공연장",
    "체험관",
    "문화공간",
    "반려견동반",
    "애견동반",
  ],
  "15": [
    "축제",
    "공연",
    "행사",
    "이벤트",
    "페스티벌",
    "마켓",
    "플리마켓",
    "반려견동반",
    "애견동반",
  ],
  "28": [
    "레포츠",
    "캠핑",
    "글램핑",
    "산책",
    "트레킹",
    "해변",
    "공원",
    "운동장",
    "반려견동반",
    "애견동반",
  ],
  "32": [
    "숙박",
    "숙소",
    "호텔",
    "펜션",
    "리조트",
    "캠핑",
    "글램핑",
    "풀빌라",
    "애견펜션",
    "반려견동반숙소",
    "애견동반숙소",
    "반려동물동반숙소",
  ],
  "38": [
    "쇼핑",
    "시장",
    "마켓",
    "몰",
    "아울렛",
    "편집숍",
    "상점",
    "펫샵",
    "애견용품",
    "반려동물용품",
    "반려견용품",
    "애견동반",
    "반려견동반",
  ],
  "39": [
    "음식점",
    "식당",
    "맛집",
    "레스토랑",
    "카페",
    "커피",
    "브런치",
    "디저트",
    "베이커리",
    "애견동반",
    "반려견동반",
    "반려동물동반",
  ],
};

const PET_CAFE_KEYWORDS = [
  "카페",
  "커피",
  "브런치",
  "디저트",
  "베이커리",
  "애견카페",
  "펫카페",
  "반려견카페",
  "반려동물카페",
  "애견동반",
  "반려견동반",
  "반려동물동반",
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

  const data = await response.json();

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

async function fetchAllPages(createUrl, maxPages = 5) {
  const firstUrl = createUrl(1);
  const firstResult = await fetchTourApi(firstUrl);

  let allItems = [...firstResult.items];

  const totalCount = firstResult.totalCount;
  const numOfRows = firstResult.numOfRows || 100;
  const totalPages = Math.ceil(totalCount / numOfRows);
  const pagesToFetch = Math.min(totalPages, maxPages);

  for (let page = 2; page <= pagesToFetch; page++) {
    const url = createUrl(page);
    const result = await fetchTourApi(url);
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

function filterByUserKeyword(items, keyword) {
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

function filterByAreaName(items, areaCode) {
  if (!areaCode) {
    return items;
  }

  const areaName = AREA_NAME_MAP[areaCode];

  if (!areaName) {
    return items;
  }

  return items.filter((item) => {
    const address = `${item.addr1 || ""} ${item.addr2 || ""}`;
    return address.includes(areaName);
  });
}

function filterByWords(items, words) {
  if (!words || words.length === 0) {
    return items;
  }

  return items.filter((item) => {
    const text = `
      ${item.title || ""}
      ${item.addr1 || ""}
      ${item.addr2 || ""}
      ${item.tel || ""}
    `.toLowerCase();

    return words.some((word) => text.includes(word.toLowerCase()));
  });
}

async function fetchKeywordExpandedItems({
  serviceKey,
  areaCode,
  keyword,
  contentTypeId,
  keywordList,
  numOfRows,
}) {
  let allItems = [];
  let estimatedTotalCount = 0;

  /*
    1. 먼저 contentTypeId 기준으로 공식 분류 데이터를 가져옵니다.
    예: 부산 + 음식점 39, 부산 + 쇼핑 38, 부산 + 숙박 32
  */
  if (contentTypeId) {
    const createTypeUrl = (pageNo) => {
      const url = makeCommonUrl(
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2",
        serviceKey,
        pageNo,
        numOfRows
      );

      url.searchParams.append("contentTypeId", contentTypeId);

      if (areaCode) {
        url.searchParams.append("areaCode", areaCode);
      }

      return url;
    };

    const typeResult = await fetchAllPages(createTypeUrl, 10);
    allItems = [...allItems, ...typeResult.items];
    estimatedTotalCount += typeResult.totalCount;
  }

  /*
    2. 관련 키워드로 넓게 검색합니다.
    예: 음식점 → 식당, 맛집, 레스토랑, 카페, 애견동반
        쇼핑 → 시장, 마켓, 펫샵, 애견용품
        숙박 → 호텔, 펜션, 애견펜션
  */
  for (const searchWord of keywordList) {
    const createAreaKeywordUrl = (pageNo) => {
      const url = makeCommonUrl(
        "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2",
        serviceKey,
        pageNo,
        numOfRows
      );

      url.searchParams.append("keyword", searchWord);

      if (areaCode) {
        url.searchParams.append("areaCode", areaCode);
      }

      return url;
    };

    const areaKeywordResult = await fetchAllPages(createAreaKeywordUrl, 3);
    allItems = [...allItems, ...areaKeywordResult.items];
    estimatedTotalCount += areaKeywordResult.totalCount;

    /*
      3. areaCode 검색에서 빠지는 데이터가 있을 수 있어서
      전국 키워드 검색 후 주소명으로 지역 필터링도 한 번 더 합니다.
    */
    if (areaCode) {
      const createNationalKeywordUrl = (pageNo) => {
        const url = makeCommonUrl(
          "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2",
          serviceKey,
          pageNo,
          numOfRows
        );

        url.searchParams.append("keyword", searchWord);

        return url;
      };

      const nationalKeywordResult = await fetchAllPages(
        createNationalKeywordUrl,
        2
      );

      const areaFilteredItems = filterByAreaName(
        nationalKeywordResult.items,
        areaCode
      );

      allItems = [...allItems, ...areaFilteredItems];
    }
  }

  let uniqueItems = removeDuplicates(allItems);

  /*
    사용자가 검색창에 해운대, 광안리, 서면 같은 단어를 입력했을 때
    결과 안에서 한 번 더 필터링합니다.
  */
  uniqueItems = filterByUserKeyword(uniqueItems, keyword);

  return {
    items: uniqueItems,
    totalCount: uniqueItems.length,
    loadedCount: uniqueItems.length,
    estimatedTotalCount,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const keyword = searchParams.get("keyword") || "";
  const areaCode = searchParams.get("areaCode") || "";
  const contentTypeId = searchParams.get("contentTypeId") || "";
  const petCafe = searchParams.get("petCafe") || "";

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

      const createNearbyUrl = (pageNo) => {
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

      const result = await fetchAllPages(createNearbyUrl, 5);

      let items = removeDuplicates(result.items);

      if (petCafe === "1") {
        items = filterByWords(items, PET_CAFE_KEYWORDS);
      }

      return NextResponse.json({
        items,
        totalCount: result.totalCount,
        loadedCount: items.length,
      });
    }

    /*
      2. 카페/애견카페
      별도 메뉴입니다.
    */
    if (petCafe === "1") {
      const result = await fetchKeywordExpandedItems({
        serviceKey,
        areaCode,
        keyword,
        contentTypeId: "39",
        keywordList: PET_CAFE_KEYWORDS,
        numOfRows,
      });

      return NextResponse.json(result);
    }

    /*
      3. 유형 선택이 있는 경우
      음식점뿐 아니라 관광지, 문화시설, 축제/공연, 레포츠, 숙박, 쇼핑까지
      모두 "분류코드 + 관련 키워드"로 확장 검색합니다.
    */
    if (contentTypeId && TYPE_KEYWORDS[contentTypeId]) {
      const result = await fetchKeywordExpandedItems({
        serviceKey,
        areaCode,
        keyword,
        contentTypeId,
        keywordList: TYPE_KEYWORDS[contentTypeId],
        numOfRows,
      });

      return NextResponse.json(result);
    }

    /*
      4. 전국 첫 화면
      검색어, 지역, 유형이 모두 없을 때는 전국에서 조금씩 가져옵니다.
    */
    if (!keyword && !areaCode && !contentTypeId) {
      const requests = AREA_CODES.map(async (code) => {
        const createAreaUrl = (pageNo) => {
          const url = makeCommonUrl(
            "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2",
            serviceKey,
            pageNo,
            20
          );

          url.searchParams.append("areaCode", code);

          return url;
        };

        const result = await fetchAllPages(createAreaUrl, 1);
        return result.items;
      });

      const results = await Promise.all(requests);
      const allItems = results.flat();
      const uniqueItems = removeDuplicates(allItems);

      return NextResponse.json({
        items: uniqueItems,
        totalCount: uniqueItems.length,
        loadedCount: uniqueItems.length,
      });
    }

    /*
      5. 일반 조회
      검색어만 있거나, 지역만 선택한 경우입니다.
    */
    const baseUrl = keyword
      ? "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2"
      : "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2";

    const createUrl = (pageNo) => {
      const url = makeCommonUrl(baseUrl, serviceKey, pageNo, numOfRows);

      if (keyword) {
        url.searchParams.append("keyword", keyword);
      }

      if (areaCode) {
        url.searchParams.append("areaCode", areaCode);
      }

      return url;
    };

    const result = await fetchAllPages(createUrl, 10);
    const uniqueItems = removeDuplicates(result.items);

    return NextResponse.json({
      items: uniqueItems,
      totalCount: result.totalCount,
      loadedCount: uniqueItems.length,
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
