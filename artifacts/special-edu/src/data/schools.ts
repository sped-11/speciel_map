export interface School {
  id: string;
  구: "동작구" | "관악구";
  학교급: "유치원" | "초등학교" | "중학교" | "고등학교" | "특수학교";
  설치별: "공립" | "사립";
  학교명: string;
  약칭: string;
  특수학급수: number;
  정원: number;
  특수배치: number;
  일반배치: number;
  잔여: number;
  에듀케어수: number;
  성별?: "남녀공학" | "남" | "녀";
  lat?: number;
  lng?: number;
}
