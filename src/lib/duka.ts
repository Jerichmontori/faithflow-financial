export const DUKA_KEY = "bumotik.danaDuka";
export const DUKA_KOLOM = Array.from({ length: 29 }, (_, i) => i + 1);

export type DukaMap = Record<string, string>;

export const bacaDuka = (): DukaMap => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DUKA_KEY) ?? "{}") as DukaMap;
  } catch {
    return {};
  }
};

export const simpanDuka = (data: DukaMap) => {
  localStorage.setItem(DUKA_KEY, JSON.stringify(data));
};

export const statusDuka = (data: DukaMap, kolom: number) => data[String(kolom)] ?? "Lunas";
