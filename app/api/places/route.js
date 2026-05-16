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
  "1", "2", "3", "4", "5", "6", "7", "8",
  "31", "32", "33", "34", "35", "36", "37", "38", "39",
];

const TYPE_KEYWORDS = {
  "12": [
    "관광지", "여행지", "공원", "해변", "해수욕장", "산책", "산책로",
    "둘레길", "정원", "숲", "반려견동반", "애견동반", "반려동물동반",
  ],
  "14": [
    "문화시설", "미술관", "박물관", "전시", "공연장", "체험관",
    "문화공간", "갤러리", "반려견동반", "애견동반", "반려동물동반",
  ],
  "15": [
    "축제", "공연", "행사", "이벤트", "페스티벌", "마켓", "플리마켓",
    "반려견동반", "애견동반", "반려동물동반",
  ],
  "28": [
    "레포츠", "캠핑", "글램핑", "산책", "트레킹", "해변", "공원",
    "운동장", "체험", "반려견동반", "애견동반", "반려동물동반",
  ],
  "32": [
    "숙박", "숙소", "호텔", "펜션", "리조트", "캠핑", "글램핑",
    "풀빌라", "게스트하우스", "애견펜션", "애견동반숙소",
    "반려견동반숙소", "반려동물동반숙소",
  ],
  "38": [
    "쇼핑", "시장", "마켓", "몰", "아울렛", "편집숍", "상점",
    "펫샵", "애견용품", "반려동물용품", "반려견용품",
    "애견동반", "반려견동반", "반려동물동반",
  ],
  "39": [
    "음식점", "식당", "맛집", "레스토랑", "카페", "커피", "브런치",
    "디저트", "베이커리", "펍", "바", "애견동반", "반려견동반",
    "반려동물동반",
  ],
};

const PET_CAFE_KEYWORDS = [
  "카페", "커피", "브런치", "디저트", "베이커리",
  "애견카페", "펫카페", "반려견카페", "반려동물카페",
  "애견동반", "반려견동반", "반려동물동반",
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

async function fetchAllPages(createUrl, maxPages = 30) {
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

function filterByAreaName(items, areaCode) {
  if (!areaCode) return items;

  const areaName = AREA_NAME_MAP[areaCode];
  if (!areaName) return items;

  return items.filter((item) => {
    const address = `${item.addr1 || ""} ${item.addr2 || ""}`;
    return address.includes(areaName);
  });
}

function filterByUserKeyword(items, keyword) {
  if (!keyword) return items;

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

function filterByWords(items, words) {
  if (!words || words.length === 0) return items;

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

async function fetchAreaAllItems({ serviceKey, areaCode, numOfRows }) {
  /*
    지역만 선택했을 때 해당 지역 전체 데이터를 최대한 많이 가져옵니다.
    예: 부산 전체 반려동물 동반 장소
  */
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

    return await fetchAllPages(createUrl, 30);
  }

  /*
    전국 전체는 너무 많을 수 있으므로 지역별로 조금씩 가져옵니다.
  */
  let allItems = [];

  const requests = AREA_CODES.map(async (code) => {
    const createUrl = (pageNo) => {
      const url = makeCommonUrl(
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2",
        serviceKey,
        pageNo,
        40
      );

      url.searchParams.append("areaCode", code);
      return url;
    };

    const result = await fetchAllPages(createUrl, 2);
    return result.items;
  });

  const results = await Promise.all(requests);
  allItems = results.flat();

  return {
    items: allItems,
    totalCount: allItems.length,
    loadedCount: allItems.length,
  };
}

async function fetchByContentType({ serviceKey, areaCode, contentTypeId, numOfRows }) {
  const createUrl = (pageNo) => {
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

  return await fetchAllPages(createUrl, 30);
}

async function fetchByKeywordList({
  serviceKey,
  areaCode,
  keywordList,
  numOfRows,
}) {
  let allItems = [];
  let totalCount = 0;

  for (const word of keywordList) {
    /*
      1. 지역코드를 넣고 검색
    */
    const createAreaKeywordUrl = (pageNo) => {
      const url = makeCommonUrl(
        "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2",
        serviceKey,
        pageNo,
        numOfRows
      );

      url.searchParams.append("keyword", word);

      if (areaCode) {
        url.searchParams.append("areaCode", areaCode);
      }

      return url;
    };

    const areaResult = await fetchAllPages(createAreaKeywordUrl, 5);
    allItems = [...allItems, ...areaResult.items];
    totalCount += areaResult.totalCount;

    /*
      2. 지역코드 검색에서 빠지는 경우 대비
         전국 검색 후 주소에 부산/서울 같은 지역명이 있는지 한 번 더 확인
    */
    if (areaCode) {
      const createNationalKeywordUrl = (pageNo) => {
        const url = makeCommonUrl(
          "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2",
          serviceKey,
          pageNo,
          numOfRows
        );

        url.searchParams.append("keyword", word);
        return url;
      };

      const nationalResult = await fetchAllPages(createNationalKeywordUrl, 3);
      const areaFiltered = filterByAreaName(nationalResult.items, areaCode);

      allItems = [...allItems, ...areaFiltered];
    }
  }

  return {
    items: allItems,
    totalCount,
    loadedCount: allItems.length,
  };
}

async function fetchExpandedType({
  serviceKey,
  areaCode,
  keyword,
  contentTypeId,
  keywordList,
  numOfRows,
}) {
  let allItems = [];

  /*
    A. 해당 지역 전체 데이터를 먼저 가져옵니다.
    여기서 contenttypeid가 맞는 것도 잡고,
    제목/주소에 관련 단어가 있는 것도 잡습니다.
  */
  const areaAllResult = await fetchAreaAllItems({
    serviceKey,
    areaCode,
    numOfRows,
  });

  const relatedFromAreaAll = areaAllResult.items.filter((item) => {
    const typeMatch = contentTypeId
      ? String(item.contenttypeid) === String(contentTypeId)
      : false;

    const wordMatch = filterByWords([item], keywordList).length > 0;

    return typeMatch || wordMatch;
  });

  allItems = [...allItems, ...relatedFromAreaAll];

  /*
    B. 공식 분류코드 기준 조회
  */
  if (contentTypeId) {
    const typeResult = await fetchByContentType({
      serviceKey,
      areaCode,
      contentTypeId,
      numOfRows,
    });

    allItems = [...allItems, ...typeResult.items];
  }

  /*
    C. 관련 키워드 확장 검색
  */
  const keywordResult = await fetchByKeywordList({
    serviceKey,
    areaCode,
    keywordList,
    numOfRows,
  });

  allItems = [...allItems, ...keywordResult.items];

  let uniqueItems = removeDuplicates(allItems);
  uniqueItems = filterByUserKeyword(uniqueItems, keyword);

  return {
    items: uniqueItems,
    totalCount: uniqueItems.length,
    loadedCount: uniqueItems.length,
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
      내 위치 기반 조회
    */
    if (mode === "nearby") {
      if (!mapX || !mapY) {
        return NextResponse.json(
          { error: "현재 위치 좌표가 없습니다." },
          { status: 400 }
        );
      }

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

      const result = await fetchAllPages(createUrl, 10);
      let items = removeDuplicates(result.items);

      if (petCafe === "1") {
        items = filterByWords(items, PET_CAFE_KEYWORDS);
      }

      return NextResponse.json({
        items,
        totalCount: items.length,
        loadedCount: items.length,
      });
    }

    /*
      카페/애견카페
    */
    if (petCafe === "1") {
      const result = await fetchExpandedType({
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
      유형 선택 있음
    */
    if (contentTypeId && TYPE_KEYWORDS[contentTypeId]) {
      const result = await fetchExpandedType({
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
      검색어가 있는 일반 검색
    */
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
      let items = removeDuplicates(result.items);

      if (areaCode) {
        items = filterByAreaName(items, areaCode);
      }

      return NextResponse.json({
        items,
        totalCount: items.length,
        loadedCount: items.length,
      });
    }

    /*
      지역만 선택 또는 전국 전체
    */
    const areaResult = await fetchAreaAllItems({
      serviceKey,
      areaCode,
      numOfRows,
    });

    const uniqueItems = removeDuplicates(areaResult.items);

    return NextResponse.json({
      items: uniqueItems,
      totalCount: uniqueItems.length,
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
