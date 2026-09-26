import { DIAL_STROKE, DIAL_VIEWBOX } from './dialGeometry';

// Halka kabuğu (ring-shell) kare ve SunArcDial viewBox'ı onu tam doldurur;
// stroke'un iç kenarı merkezden (viewBox - 2·stroke) / 2 uzaklıkta.
export function ringInnerDiameter(shellWidth: number): number {
  return (shellWidth * (DIAL_VIEWBOX - 2 * DIAL_STROKE)) / DIAL_VIEWBOX;
}

// Merkezli w×h dikdörtgen, çapı d olan daireye ancak ve ancak köşegeni
// çapı aşmıyorsa (w² + h² <= d²) sığar — sabit eşik/oran yok.
export function contentFitsRing(width: number, height: number, diameter: number): boolean {
  return width ** 2 + height ** 2 <= diameter ** 2;
}
