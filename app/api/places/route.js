import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const pageNo = searchParams.get("pageNo") || "1";
  const numOfRows = searchParams.get("numOfRows") || "80";
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
      { error: "TOUR_API_KEY가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  try {
    let baseUrl = "";

    if (mode === "nearby") {
      baseUrl =
        "https://apis.data.go.kr/B551011/KorPetTourService2/locationBasedList2";
    } else if (keyword) {
      baseUrl =
        "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2";
    } else {
      baseUrl =
        "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2";
    }

    const url = new URL(baseUrl);

    url.searchParams.append("serviceKey", serviceKey);
    url.searchParams.append("MobileOS", "ETC");
    url.searchParams.append("MobileApp", "pet-travel-guide");
    url.searchParams.append("_type", "json");
    url.searchParams.append("pageNo", pageNo);
    url.searchParams.append("numOfRows", numOfRows);
    url.searchParams.append("arrange", "Q");

    if (mode === "nearby") {
      if (!mapX || !mapY) {
        return NextResponse.json(
          { error: "현재 위치 좌표가 없습니다." },
          { status: 400 }
        );
      }

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

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const data = await response.json();

    const resultCode = data?.response?.header?.resultCode;
    const resultMsg = data?.response?.header?.resultMsg;

    if (resultCode && resultCode !== "0000") {
      return NextResponse.json(
        {
          error: "공공데이터 API 응답 오류",
          detail: resultMsg || "API 요청에 실패했습니다.",
          resultCode,
        },
        { status: 500 }
      );
    }

    const items = data?.response?.body?.items?.item;

    let itemList = [];

    if (Array.isArray(items)) {
      itemList = items;
    } else if (items) {
      itemList = [items];
    }

    const uniqueItems = [];
    const seen = new Set();

    for (const item of itemList) {
      const key = item.contentid || `${item.title}-${item.addr1}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    }

    return NextResponse.json({
      items: uniqueItems,
      totalCount: data?.response?.body?.totalCount || uniqueItems.length,
      pageNo: data?.response?.body?.pageNo || pageNo,
      numOfRows: data?.response?.body?.numOfRows || numOfRows,
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
