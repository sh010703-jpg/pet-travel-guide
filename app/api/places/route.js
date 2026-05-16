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

function filterCafeLikeItems(items) {
  const cafeWords = [
    "카페",
    "커피",
    "coffee",
    "브런치",
    "디저트",
    "베이커리",
    "펫카페",
    "애견",
    "반려견",
    "반려동물",
  ];

  return items.filter((item) => {
    const text = `
      ${item.title || ""}
      ${item.addr1 || ""}
      ${item.addr2 || ""}
      ${item.tel || ""}
    `.toLowerCase();

    return cafeWords.some((word) => text.includes(word.toLowerCase()));
  });
}

function makeCommonUrl(baseUrl, serviceKey, pageNo, numOfRows) {
  const url = new URL(baseUrl);

  url.searchParams.append("serviceKey", serviceKey);
  url.searchParams.append("MobileOS", "ETC");
  url.searchParams.append("MobileApp", "pet-travel-guide");
  url.searchParams.append("_type", "json");
  url.searchParams.append("pageNo", pageNo);
  url.searchParams.append("numOfRows", numOfRows);
  url.searchParams.append("arrange", "Q");

  return url;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const pageNo = searchParams.get("pageNo") || "1";
  const numOfRows = searchParams.get("numOfRows") || "120";
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

      let items = await fetchTourApi(url);

      if (petCafe === "1") {
        items = filterCafeLikeItems(items);
      }

      return NextResponse.json({
        items: removeDuplicates(items),
        totalCount: items.length,
        pageNo,
        numOfRows,
      });
    }

    /*
      2. 카페/애견카페 조회
      - "애견카페"만 찾으면 누락이 많아서 여러 키워드로 넓게 검색
      - areaCode 검색 결과가 적을 수 있어 전국 검색 후 주소로 지역 필터도 한 번 더 수행
      - 음식점 39번 데이터에서도 카페성 단어를 다시 필터링
    */
    if (petCafe === "1") {
      const cafeKeywords = [
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
      ];

      let allItems = [];

      for (const cafeKeyword of cafeKeywords) {
        /*
          2-1. 지역코드를 포함한 키워드 검색
        */
        const areaKeywordUrl = makeCommonUrl(
          "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2",
          serviceKey,
          "1",
          numOfRows
        );

        areaKeywordUrl.searchParams.append("keyword", cafeKeyword);

        if (areaCode) {
          areaKeywordUrl.searchParams.append("areaCode", areaCode);
        }

        const areaKeywordItems = await fetchTourApi(areaKeywordUrl);
        allItems = [...allItems, ...areaKeywordItems];

        /*
          2-2. 지역코드 검색에서 빠지는 경우를 대비해 전국 검색 후 주소로 지역 필터
        */
        if (areaCode) {
          const nationalKeywordUrl = makeCommonUrl(
            "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2",
            serviceKey,
            "1",
            numOfRows
          );

          nationalKeywordUrl.searchParams.append("keyword", cafeKeyword);

          const nationalItems = await fetchTourApi(nationalKeywordUrl);
          const areaFilteredItems = filterByAreaName(nationalItems, areaCode);

          allItems = [...allItems, ...areaFilteredItems];
        }
      }

      /*
        2-3. 음식점 39번 데이터도 함께 가져온 뒤,
        그중 카페성 단어가 있는 것만 추가
      */
      const foodUrl = makeCommonUrl(
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2",
        serviceKey,
        "1",
        "200"
      );

      foodUrl.searchParams.append("contentTypeId", "39");

      if (areaCode) {
        foodUrl.searchParams.append("areaCode", areaCode);
      }

      const foodItems = await fetchTourApi(foodUrl);
      const cafeLikeFoodItems = filterCafeLikeItems(foodItems);

      allItems = [...allItems, ...cafeLikeFoodItems];

      let uniqueItems = removeDuplicates(allItems);

      /*
        사용자가 검색창에 해운대, 광안리, 서면 같은 단어를 넣었을 때
        결과 안에서 한 번 더 필터링
      */
      uniqueItems = filterByUserKeyword(uniqueItems, keyword);

      return NextResponse.json({
        items: uniqueItems,
        totalCount: uniqueItems.length,
        pageNo,
        numOfRows,
      });
    }

    /*
      3. 일반 검색
    */
    const baseUrl = keyword
      ? "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2"
      : "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2";

    const url = makeCommonUrl(baseUrl, serviceKey, pageNo, numOfRows);

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
