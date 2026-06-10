import { useEffect, useRef, useState, useCallback } from "react";
import { School } from "@/data/schools";
import { kindergartenCoords } from "@/data/kindergartenCoords";

declare global {
  interface Window {
    kakao: any;
  }
}

interface Props {
  schools: School[];
  onSelectSchool: (school: School) => void;
  selectedSchool: School | null;
  apiKey: string;
}

const coordCache: Record<string, { lat: number; lng: number } | null> = {};

const DONGJAK_CENTER = { lat: 37.5121, lng: 126.9395 };
const GWANAK_CENTER = { lat: 37.4784, lng: 126.9516 };
const BOTH_CENTER = { lat: 37.4953, lng: 126.9455 };

function markerColor(school: School) {
  if (school.학교급 === "특수학교") return "#7c3aed";
  if (school.잔여 < 0) return "#dc2626";
  if (school.잔여 === 0) return "#f59e0b";
  if (school.잔여 >= 5) return "#16a34a";
  return "#2563eb";
}

function levelEmoji(학교급: string) {
  return { 유치원: "🌸", 초등학교: "🏫", 중학교: "📚", 고등학교: "🎓", 특수학교: "⭐" }[학교급] ?? "🏫";
}

export default function KakaoMap({ schools, onSelectSchool, selectedSchool, apiKey }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeCount, setGeocodeCount] = useState(0);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const kakao = window.kakao;
    kakao.maps.load(() => {
      const center = new kakao.maps.LatLng(BOTH_CENTER.lat, BOTH_CENTER.lng);
      const map = new kakao.maps.Map(mapRef.current, {
        center,
        level: 6,
      });
      mapInstanceRef.current = map;
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }

    if (window.kakao?.maps) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => initMap();
    script.onerror = () => setLoading(false);
    document.head.appendChild(script);
  }, [apiKey, initMap]);

  const geocodeSchool = useCallback(async (school: School): Promise<{ lat: number; lng: number } | null> => {
    if (coordCache[school.학교명] !== undefined) return coordCache[school.학교명];

    // 유치원은 정확한 좌표 데이터 우선 사용
    if (kindergartenCoords[school.학교명]) {
      const coord = kindergartenCoords[school.학교명];
      coordCache[school.학교명] = coord;
      return coord;
    }

    return new Promise((resolve) => {
      const kakao = window.kakao;
      if (!kakao?.maps?.services) { resolve(null); return; }

      const ps = new kakao.maps.services.Places();
      // 병설유치원 → 모교 이름으로 검색 (같은 위치)
      const baseName = school.학교명.endsWith("병설유치원")
        ? school.학교명.replace("병설유치원", "")
        : school.학교명;
      // "서울"이 없으면 구 이름 추가하여 정확도 향상
      const keyword = baseName.includes("서울")
        ? baseName
        : `${school.구} ${baseName}`;
      ps.keywordSearch(keyword, (data: any[], status: string) => {
        if (status === kakao.maps.services.Status.OK && data.length > 0) {
          const result = { lat: parseFloat(data[0].y), lng: parseFloat(data[0].x) };
          coordCache[school.학교명] = result;
          resolve(result);
        } else {
          coordCache[school.학교명] = null;
          resolve(null);
        }
      }, {
        location: new kakao.maps.LatLng(BOTH_CENTER.lat, BOTH_CENTER.lng),
        radius: 10000,
      });
    });
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.kakao?.maps || !apiKey) return;

    const kakao = window.kakao;

    markersRef.current.forEach(m => m.setMap(null));
    overlaysRef.current.forEach(o => o.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];

    setGeocoding(true);
    let completed = 0;
    let cancelled = false;

    const schoolsToShow = schools.filter(s => s.특수배치 > 0 || s.일반배치 > 0 || s.학교급 === "특수학교");

    if (schoolsToShow.length === 0) {
      setGeocoding(false);
      setGeocodeCount(0);
      return;
    }

    const placeMarker = (school: School, coord: { lat: number; lng: number }) => {
      const position = new kakao.maps.LatLng(coord.lat, coord.lng);
      const color = markerColor(school);
      const emoji = levelEmoji(school.학교급);

      const isSelected = selectedSchool?.id === school.id;

      const isSpecialSchool = school.학교급 === "특수학교";
      const janyeoText = isSpecialSchool
        ? ""
        : school.특수학급수 === 0
          ? " · 미설치"
          : school.잔여 > 0
            ? ` · ${school.잔여}명`
            : school.잔여 < 0
              ? " · 과밀"
              : " · Full";

      const content = `
        <div style="
          position:relative;
          display:flex;
          flex-direction:column;
          align-items:center;
          cursor:pointer;
        ">
          <div style="
            background:${isSelected ? '#4c1d95' : color};
            color:white;
            font-size:11px;
            font-weight:700;
            padding:3px 7px;
            border-radius:6px;
            white-space:nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            border: ${isSelected ? '2px solid #fff' : 'none'};
            line-height:1.4;
          ">
            ${emoji} ${school.약칭}
            <span style="opacity:0.85;font-weight:500;">${janyeoText}</span>
          </div>
          <div style="
            width:0;height:0;
            border-left:5px solid transparent;
            border-right:5px solid transparent;
            border-top:7px solid ${isSelected ? '#4c1d95' : color};
          "></div>
        </div>
      `;

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position,
        content,
        yAnchor: 1,
        zIndex: isSelected ? 10 : 1,
      });

      overlay.getContent = () => content;

      kakao.maps.event.addListener(overlay, "click", () => {
        onSelectSchool(school);
      });

      const clickTarget = overlay.getNode ? overlay.getNode() : null;
      if (clickTarget) {
        clickTarget.addEventListener("click", () => onSelectSchool(school));
      }

      markersRef.current.push(overlay);
      overlaysRef.current.push(overlay);
    };

    const process = async () => {
      for (const school of schoolsToShow) {
        if (cancelled) return;
        const coord = await geocodeSchool(school);
        if (cancelled) return;
        completed++;
        setGeocodeCount(completed);
        if (coord) {
          placeMarker(school, coord);
        }
        await new Promise(r => setTimeout(r, 80));
      }
      if (!cancelled) setGeocoding(false);
    };

    process();

    return () => {
      cancelled = true;
    };
  }, [schools, apiKey, geocodeSchool, onSelectSchool, selectedSchool]);

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/50 rounded-xl text-center p-8">
        <div className="text-5xl mb-4">🗺️</div>
        <h3 className="text-lg font-bold text-foreground mb-2">카카오맵 API 키 설정 필요</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          지도를 표시하려면 카카오 개발자 콘솔에서 앱을 등록하고 JavaScript 키를 입력해주세요.
        </p>
        <div className="bg-white border border-border rounded-lg p-4 text-left text-sm space-y-2 max-w-sm w-full">
          <p className="font-semibold">설정 방법:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li><a href="https://developers.kakao.com" target="_blank" className="text-blue-600 underline">developers.kakao.com</a> 접속</li>
            <li>내 애플리케이션 → 앱 키 → JavaScript 키 복사</li>
            <li>플랫폼 → Web → 사이트 도메인에 이 앱 URL 추가</li>
            <li>Replit Secrets에 <code className="bg-muted px-1 rounded">VITE_KAKAO_MAP_KEY</code> 추가</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-[#1B4FA8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">지도 로딩 중...</p>
          </div>
        </div>
      )}
      {!loading && geocoding && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur rounded-full px-4 py-2 text-xs font-medium text-muted-foreground shadow-md flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[#1B4FA8] border-t-transparent rounded-full animate-spin" />
          학교 위치 검색 중... ({geocodeCount}개 완료)
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
      {/* Legend */}
      {!loading && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow-md text-xs space-y-1">
          <div className="font-semibold text-foreground mb-1">잔여 자리</div>
          {[
            { color: "#16a34a", label: "5명 이상" },
            { color: "#2563eb", label: "1-4명" },
            { color: "#f59e0b", label: "없음(Full)" },
            { color: "#dc2626", label: "과밀" },
            { color: "#7c3aed", label: "특수학교" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: item.color }} />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
