/**
 * Single source of every Phosphor icon this app actually renders, each
 * imported from its own per-icon subpath instead of the package barrel.
 * The barrel (`@phosphor-icons/react`) re-exports all ~1300 icons across
 * 6 weights each — importing even one icon from it pulled the whole set
 * into the bundle (525 kB / 161 kB gzip pre-fix, design-refresh-v3 Faz 2
 * F5). Every component should import icons from here, never directly
 * from '@phosphor-icons/react'.
 */
export { IconContext } from '@phosphor-icons/react/dist/lib/context';
export type { Icon } from '@phosphor-icons/react/dist/lib/types';

export { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
export { BellIcon } from '@phosphor-icons/react/dist/csr/Bell';
export { BookOpenIcon } from '@phosphor-icons/react/dist/csr/BookOpen';
export { CalendarDotsIcon } from '@phosphor-icons/react/dist/csr/CalendarDots';
export { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown';
export { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
export { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock';
export { CloudSunIcon } from '@phosphor-icons/react/dist/csr/CloudSun';
export { CompassIcon } from '@phosphor-icons/react/dist/csr/Compass';
export { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy';
export { DeviceMobileIcon } from '@phosphor-icons/react/dist/csr/DeviceMobile';
export { GearIcon } from '@phosphor-icons/react/dist/csr/Gear';
export { GearSixIcon } from '@phosphor-icons/react/dist/csr/GearSix';
export { HandHeartIcon } from '@phosphor-icons/react/dist/csr/HandHeart';
export { LockIcon } from '@phosphor-icons/react/dist/csr/Lock';
export { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
export { MapPinIcon } from '@phosphor-icons/react/dist/csr/MapPin';
export { MoonIcon } from '@phosphor-icons/react/dist/csr/Moon';
export { MoonStarsIcon } from '@phosphor-icons/react/dist/csr/MoonStars';
export { NavigationArrowIcon } from '@phosphor-icons/react/dist/csr/NavigationArrow';
export { PlayIcon } from '@phosphor-icons/react/dist/csr/Play';
export { QuotesIcon } from '@phosphor-icons/react/dist/csr/Quotes';
export { ShareNetworkIcon } from '@phosphor-icons/react/dist/csr/ShareNetwork';
export { SparkleIcon } from '@phosphor-icons/react/dist/csr/Sparkle';
export { SpeakerHighIcon } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
export { SpeakerXIcon } from '@phosphor-icons/react/dist/csr/SpeakerX';
export { SunIcon } from '@phosphor-icons/react/dist/csr/Sun';
export { SunDimIcon } from '@phosphor-icons/react/dist/csr/SunDim';
export { SunHorizonIcon } from '@phosphor-icons/react/dist/csr/SunHorizon';
export { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle';
export { XIcon } from '@phosphor-icons/react/dist/csr/X';
