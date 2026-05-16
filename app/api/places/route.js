import { NextResponse } from "next/server";

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
    const baseUrl = keyword
      ? "https://apis.data.go.kr/B551011/KorPetTourService2/searchKeyword2"
      : "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2";

    const url = new URL(baseUrl);

    url.searchParams.append("serviceKey", serviceKey);
    url.searchParams.append("MobileOS", "ETC");
    url.searchParams.append("MobileApp", "pet-travel-guide");
    url.searchParams.append("_type", "json");
    url.searchParams.append("pageNo", pageNo);
    url.searchParams.append("numOfRows", numOfRows);
    url.searchParams.append("arrange", "Q");

    /*
      전국 조회를 위해 areaCode는 넣지 않습니다.
      부산만 나오게 하려면 areaCode=6을 넣으면 됩니다.
      지금은 전국 서비스이므로 아래 코드가 없어야 합니다.

      url.searchParams.append("areaCode", "6");
    */

    if (keyword) {
      url.searchParams.append("keyword", keyword);
    }

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const data = await response.json();

    const items = data?.response?.body?.items?.item;

    let itemList = [];

    if (Array.isArray(items)) {
      itemList = items;
    } else if (items) {
      itemList = [items];
    }

    return NextResponse.json({
      items: itemList,
      totalCount: data?.response?.body?.totalCount || 0,
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
