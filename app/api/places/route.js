import { NextResponse } from "next/server";

export async function GET() {
  const serviceKey = process.env.TOUR_API_KEY;

  if (!serviceKey) {
    return NextResponse.json(
      {
        success: false,
        error: "TOUR_API_KEY가 Vercel에 설정되어 있지 않습니다.",
      },
      { status: 500 }
    );
  }

  try {
    const url = new URL(
      "https://apis.data.go.kr/B551011/KorPetTourService2/areaBasedList2"
    );

    url.searchParams.append("serviceKey", serviceKey);
    url.searchParams.append("MobileOS", "ETC");
    url.searchParams.append("MobileApp", "pet-travel-guide");
    url.searchParams.append("_type", "json");
    url.searchParams.append("pageNo", "1");
    url.searchParams.append("numOfRows", "20");
    url.searchParams.append("arrange", "Q");

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "공공데이터 응답이 JSON이 아닙니다.",
          rawResponse: text.slice(0, 500),
        },
        { status: 500 }
      );
    }

    const resultCode = data?.response?.header?.resultCode;
    const resultMsg = data?.response?.header?.resultMsg;

    if (resultCode && resultCode !== "0000") {
      return NextResponse.json(
        {
          success: false,
          error: "공공데이터 API 오류",
          resultCode,
          resultMsg,
        },
        { status: 500 }
      );
    }

    const items = data?.response?.body?.items?.item || [];
    const itemList = Array.isArray(items) ? items : [items];

    return NextResponse.json({
      success: true,
      message: "공공데이터 API 연결 성공",
      totalCount: data?.response?.body?.totalCount || 0,
      loadedCount: itemList.length,
      firstItem: itemList[0] || null,
      items: itemList,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "route.js 실행 중 오류",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
