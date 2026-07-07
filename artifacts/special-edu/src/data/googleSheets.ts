// ================================================================
// 구글 스프레드시트 CSV 주소 설정
// 시트 주소를 바꾸려면 아래 상수 3개만 수정하면 됩니다.
// ================================================================
const SHEETS_BASE =
  "https://docs.google.com/spreadsheets/d/e/" +
  "2PACX-1vTdakk6M5LA_35lDoIUXSH5P6tNINTWSyNrEggR17oG6LIcsvrKY5AFgn5CDpu9y-MpV6cMTAgm7IHU" +
  "/pub";

/** 시트1 — schools: 구·학교급·설치별·학교명·약칭·특수학급수·정원·에듀케어수 */
export const SCHOOLS_CSV_URL =
  `${SHEETS_BASE}?gid=1502716267&single=true&output=csv`;

/** 시트2 — students: 학교급·학교·학년·배치형태 (1행 = 학생 1명) */
export const STUDENTS_CSV_URL =
  `${SHEETS_BASE}?gid=2104296666&single=true&output=csv`;

/** 시트3 — basic_info: 지역·학교명·위도·경도·남녀공학구분·공사립구분 */
export const BASIC_INFO_CSV_URL =
  `${SHEETS_BASE}?gid=0&single=true&output=csv`;
// ================================================================

import type { School } from "./schools";
import type { StudentData } from "./students";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuote = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = "";
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some(c => c.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c.length > 0)) rows.push(row);
  }
  return rows;
}

async function fetchCSV(url: string): Promise<string[][]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`시트 데이터 불러오기 실패 (HTTP ${res.status})`);
  return parseCSV(await res.text());
}

function parseGender(raw: string = ""): School["성별"] {
  const s = raw.replace(/\s+/g, "");
  if (s.includes("남학교") || s === "남") return "남";
  if (s.includes("여학교") || s === "여" || s === "녀") return "녀";
  return "남녀공학";
}

export async function loadAllData(): Promise<{ schools: School[]; studentData: StudentData }> {
  const [schoolRows, studentRows, basicInfoRows] = await Promise.all([
    fetchCSV(SCHOOLS_CSV_URL),
    fetchCSV(STUDENTS_CSV_URL),
    fetchCSV(BASIC_INFO_CSV_URL),
  ]);

  type BasicInfo = {
    lat: number; lng: number;
    성별: School["성별"];
    구?: School["구"];
    설치별?: School["설치별"];
  };

  const basicMap: Record<string, BasicInfo> = {};
  for (const row of basicInfoRows.slice(1)) {
    const [지역, 학교명, latStr, lngStr, 성별raw, 공사립] = row;
    if (!학교명) continue;
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    let 구: School["구"] | undefined;
    if (지역?.includes("동작구")) 구 = "동작구";
    else if (지역?.includes("관악구")) 구 = "관악구";
    basicMap[학교명] = {
      lat: isNaN(lat) ? 0 : lat,
      lng: isNaN(lng) ? 0 : lng,
      성별: parseGender(성별raw),
      구,
      설치별: (공사립?.includes("사립") ? "사립" : "공립") as School["설치별"],
    };
  }

  const placementTotals: Record<string, { 특수배치: number; 일반배치: number }> = {};
  const studentData: StudentData = {};
  const schoolLevelMap: Record<string, string> = {};

  for (const row of studentRows.slice(1)) {
    const [학교급, 원명, 학년, 배치형태] = row;
    if (!원명 || !학년 || !배치형태) continue;
    const 학교명 = 원명 === "(가칭)흑석고등학교" ? "흑석고등학교" : 원명;

    schoolLevelMap[학교명] = 학교급;
    if (!placementTotals[학교명]) placementTotals[학교명] = { 특수배치: 0, 일반배치: 0 };
    if (!studentData[학교명]) studentData[학교명] = {};
    if (!studentData[학교명][학년]) studentData[학교명][학년] = { 특수학급: 0, 일반학급: 0 };

    if (배치형태 === "특수학급") {
      placementTotals[학교명].특수배치++;
      studentData[학교명][학년].특수학급++;
    } else {
      placementTotals[학교명].일반배치++;
      studentData[학교명][학년].일반학급++;
    }
  }

  const schools: School[] = [];
  const processedNames = new Set<string>();
  let idx = 0;

  for (const row of schoolRows.slice(1)) {
    const [구raw, 학교급raw, 설치별raw, 학교명, 약칭, 특수학급수str, 정원str, 에듀케어수str] = row;
    if (!학교명) continue;

    const plc = placementTotals[학교명] ?? { 특수배치: 0, 일반배치: 0 };
    const 특수학급수 = parseInt(특수학급수str) || 0;
    const 정원 = parseInt(정원str) || 0;
    const 에듀케어수 = parseInt(에듀케어수str) || 0;
    const bi = basicMap[학교명];

    schools.push({
      id: `s${String(++idx).padStart(3, "0")}`,
      구: (구raw || bi?.구 || "동작구") as School["구"],
      학교급: 학교급raw as School["학교급"],
      설치별: (설치별raw || bi?.설치별 || "공립") as School["설치별"],
      학교명,
      약칭: 약칭 || 학교명,
      특수학급수,
      정원,
      특수배치: plc.특수배치,
      일반배치: plc.일반배치,
      잔여: 정원 - plc.특수배치,
      에듀케어수,
      성별: bi?.성별,
      lat: bi?.lat,
      lng: bi?.lng,
    });
    processedNames.add(학교명);
  }

  for (const [학교명, 학교급] of Object.entries(schoolLevelMap)) {
    if (학교급 !== "특수학교" || processedNames.has(학교명)) continue;
    const plc = placementTotals[학교명] ?? { 특수배치: 0, 일반배치: 0 };
    const bi = basicMap[학교명];
    schools.push({
      id: `s${String(++idx).padStart(3, "0")}`,
      구: bi?.구 ?? "동작구",
      학교급: "특수학교",
      설치별: bi?.설치별 ?? "공립",
      학교명,
      약칭: 학교명,
      특수학급수: 0,
      정원: 0,
      특수배치: 0,
      일반배치: plc.일반배치,
      잔여: 0,
      에듀케어수: 0,
      성별: bi?.성별,
      lat: bi?.lat,
      lng: bi?.lng,
    });
    processedNames.add(학교명);
  }

  return { schools, studentData };
}
