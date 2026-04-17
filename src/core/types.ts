// ── Shared domain types ──────────────────────────────────────────

export interface ResourceOptions {
  configBaseUrl: string;
  configIndex: string;
  alteredIconsCss: string;
  qrcodeLib: string;
  cardApiUrl: string;
  proxyUrl: string | false;
  useApiBackground: boolean;
  backgroundUrl: string;
  backgroundUrlIdTransform: [string, string][];
  embeddedConfig: ForgeConfig | null;
  _resolvedProxy?: string;
}

export interface FontNames {
  regular: string;
  bold: string;
  italic: string;
  circled: string | null;
  [key: string]: string | null;
}

export interface ForgeConfig {
  elements: ElementDef[];
  frameParts?: FramePartDef[];
  frameTypes?: Record<string, FrameTypeConfig>;
  factions?: Record<string, FactionConfig>;
  globalDefaults?: Record<string, Partial<ElementSettings>>;
  biomeBackgrounds?: Record<string, Record<string, BiomeVariantConfig | string>>;
  setLogos?: { code: string; file: string }[];
  font?: FontConfig;
  placeholderBg?: { enabled: boolean; file: string };
  cardsData?: Record<string, unknown>;
  cardApiUrl?: string;
  qrLogo?: { enabled: boolean; file: string };
  [key: string]: unknown;
}

export interface ElementDef {
  id: string;
  inputType: string;
  align?: string;
  isBiome?: boolean;
  biomeKey?: string;
  isAdmin?: boolean;
  infoLinePart?: boolean;
  hasMaxWidth?: boolean;
  fields?: Array<{ ref: string; prefix?: string; suffix?: string }>;
}

export interface FramePartDef {
  id: string;
  file?: string;
  default?: Partial<OverlaySettings>;
  order?: number;
}

export interface FrameTypeConfig {
  frameParts?: Record<string, { visible?: boolean }>;
  factionOverrides?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export interface FactionConfig {
  types: Record<string, TypeConfig>;
}

export interface TypeConfig {
  collection?: string;
  frameType?: string;
  frameFile?: string;
  defaults?: Record<string, unknown>;
}

export interface BiomeVariantConfig {
  file?: string;
  bgX?: number;
  bgY?: number;
  bgSize?: number;
  bgW?: number;
  bgH?: number;
  textShadow?: string | null;
}

export interface FontConfig {
  fallback?: string;
  file?: string;
  name?: string;
  regular?: { file: string; name: string };
  bold?: { file: string; name: string };
  italic?: { file: string; name: string };
  circled?: { file: string; name: string };
}

export interface ElementSettings {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  maxWidth: number;
  lineHeight: number;
  maxLines: number;
  x2: number | null;
  maxWidth2: number | null;
  size: number;
  w: number | null;
  h: number | null;
  visible: boolean;
  align: string;
  fontStyle: string;
  textShadow: string | null;
  opacity: number;
  defaultValue: string;
  rectCount: number;
  rectW: number;
  rectH: number;
  rectGap: number;
  rectRadius: number;
  rectColor: string;
  bgVariant: string;
  bgSize: number;
  bgX: number;
  bgY: number;
  bgW: number;
  bgH: number;
}

export interface OverlaySettings {
  visible: boolean;
  x: number;
  y: number;
  size: number;
}

export interface BgTransform {
  zoom: number;
  x: number;
  y: number;
  flipX: boolean;
}

export interface CardImages {
  bg: HTMLImageElement | null;
  frame: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  frameParts: Record<string, HTMLImageElement>;
  adminWatermark: HTMLImageElement | null;
  qrLogo: HTMLImageElement | null;
  [key: string]: HTMLImageElement | Record<string, HTMLImageElement> | null;
}

export interface BiomeImages {
  forest: Record<string, HTMLImageElement>;
  mountain: Record<string, HTMLImageElement>;
  ocean: Record<string, HTMLImageElement>;
}

export interface CardState {
  config: ForgeConfig;
  elements: ElementDef[];
  fontNames: FontNames;
  images: CardImages;
  biomeImages: BiomeImages;
  settings: Record<string, ElementSettings>;
  values: Record<string, string>;
  overlaySettings: Record<string, OverlaySettings>;
  bg: BgTransform;
  qrSource: HTMLImageElement | HTMLCanvasElement | null;
  activeTypeCfg: TypeConfig;
  activeFrameTypeId: string | null;
  _qrLogoOverride: HTMLImageElement | null;
  _isAdmin: boolean;
  _ref: string;
}

export interface CardJson {
  _type?: string;
  _ref?: string;
  _selection?: {
    faction?: string;
    collection?: string;
    type?: string;
    setCode?: string | null;
    bgTransform?: BgTransform;
  };
  globalDefaults?: Record<string, Record<string, unknown>>;
  _images?: Record<string, string>;
  _urls?: Record<string, string>;
  [key: string]: unknown;
}

export interface LoaderStore {
  opts: ResourceOptions;
  cfg: ForgeConfig | null;
  fontNames: FontNames;
  biomeImages: BiomeImages | null;
  placeholderImg: HTMLImageElement | null;
  loadedIndex: unknown;
}

export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  isIcon: boolean;
  color: string | null;
  fontScale: number;
}

export interface TextSegment {
  text: string;
  isIcon: boolean;
  isCircled: boolean;
}

export interface MappingDef {
  lang?: string;
  langFallback?: string;
  selection?: unknown;
  background?: unknown;
  setCode?: unknown;
  bgTransform?: unknown;
  values?: Record<string, unknown>;
}

export interface Zone2 {
  fromLine: number;
  x: number;
  maxWidth: number;
}

export interface PlaceholderConfig {
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
}
