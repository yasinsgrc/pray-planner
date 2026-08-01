declare module 'hijri-converter' {
  export function toHijri(gy: number, gm: number, gd: number): { hy: number; hm: number; hd: number };
  export function toGregorian(hy: number, hm: number, hd: number): { gy: number; gm: number; gd: number };
}
