import { pick, randomInt } from "@shared/lib/random";

/** 한글 랜덤 닉네임: 형용사 + 명사. 충돌 시 숫자 접미. */
const ADJECTIVES = [
  "졸린", "용감한", "조용한", "수줍은", "씩씩한", "느긋한", "재빠른", "명랑한",
  "차분한", "엉뚱한", "부지런한", "다정한", "든든한", "어리둥절한", "반짝이는", "포근한",
  "새침한", "장난꾸러기", "똑똑한", "배고픈", "신나는", "호기심많은", "느릿느릿", "깜찍한",
  "우아한", "당당한", "몽글몽글한", "알쏭달쏭한", "따뜻한", "시원한", "야무진", "말랑한",
];

const NOUNS = [
  "두부", "고양이", "수달", "펭귄", "감자", "고구마", "너구리", "다람쥐",
  "돌고래", "코알라", "판다", "햄스터", "라마", "알파카", "문어", "해파리",
  "양파", "호빵", "붕어빵", "송편", "떡볶이", "김밥", "만두", "단팥빵",
  "구름", "달님", "별똥별", "이슬", "조약돌", "솔방울", "민들레", "도토리",
];

export function randomNickname(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

/** taken에 없는 닉네임을 만든다. 조합이 다 찼으면 숫자를 붙인다. */
export function uniqueNickname(taken: Set<string>): string {
  for (let i = 0; i < 30; i++) {
    const n = randomNickname();
    if (!taken.has(n)) return n;
  }
  for (let i = 0; i < 1000; i++) {
    const n = `${randomNickname()} ${randomInt(900) + 100}`;
    if (!taken.has(n)) return n;
  }
  return `${randomNickname()} ${Date.now() % 100000}`;
}
