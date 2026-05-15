export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const pageNo = searchParams.get("pageNo") || "1";
  const numOfRows = searchParams.get("numOfRows") || "50";
  const keyword = searchParams.get("keyword") || "";
  const areaCode = searchParams.get("areaCode") || "6"; // 부산
  const serviceKey = process.env.DATA_API_KEY;

  if (!serviceKey) {
    return Response.json(
      { error: "DATA_API_KEY가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  const baseUrl = "https://apis.data.go.kr/B551011/KorPetTourService2";
  const endpoint = keyword ? "searchKeyword2" : "areaBasedList2";

  const params = new URLSearchParams({
    serviceKey,
    pageNo,
    numOfRows,
    MobileOS: "ETC",
    MobileApp: "PetTravelGuide",
    _type: "json",
    areaCode
  });

  if (keyword) {
    params.append("keyword", keyword);
  }

  const apiUrl = `${baseUrl}/${endpoint}?${params.toString()}`;

  try {
    const response = await fetch(apiUrl, {
      cache: "no-store"
    });

    if (!response.ok) {
      return Response.json(
        { error: "공공데이터 API 호출에 실패했습니다." },
        { status: response.status }
      );
    }

    const data = await response.json();

    const header = data?.response?.header;
    const body = data?.response?.body;
    const rawItems = body?.items?.item || [];

    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    return Response.json({
      resultCode: header?.resultCode,
      resultMsg: header?.resultMsg,
      totalCount: body?.totalCount || items.length,
      items
    });
  } catch (error) {
    return Response.json(
      {
        error: "서버에서 데이터를 불러오는 중 오류가 발생했습니다.",
        detail: error.message
      },
      { status: 500 }
    );
  }
}
