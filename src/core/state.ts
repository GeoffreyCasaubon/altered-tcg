import type {
  ForgeConfig, CardJson, CardState, ElementSettings, OverlaySettings,
  ElementDef, FactionConfig, TypeConfig, BgTransform,
} from './types';

export function buildStateFromJson(config: ForgeConfig, cardJson: CardJson): CardState {
  const G    = (config.globalDefaults   || {}) as Record<string, Partial<ElementSettings>>;
  const defs = (cardJson.globalDefaults || {}) as Record<string, Partial<ElementSettings & { value?: string; url?: string }>>;
  const sel  = (cardJson._selection     || {}) as {
    faction?: string;
    collection?: string;
    type?: string;
    setCode?: string | null;
    bgTransform?: Partial<BgTransform>;
  };

  const factionCfg = (config.factions?.[sel.faction ?? ''] || {}) as Partial<FactionConfig>;
  let typeCfg: TypeConfig | null = factionCfg.types?.[sel.type ?? ''] || null;
  if (!typeCfg && sel.type?.includes('::')) {
    const [col, ftKey] = sel.type.split('::');
    typeCfg = Object.values(factionCfg.types || {}).find(
      t => t.collection === col && t.frameType === ftKey
    ) || null;
  }
  const resolvedTypeCfg: TypeConfig = typeCfg || {};

  const ftId              = resolvedTypeCfg.frameType                                    || null;
  const ftDefaults        = ftId ? ((config.frameTypes?.[ftId] || {}) as Record<string, unknown>) : {} as Record<string, unknown>;
  const ftFactionOverride = sel.faction
    ? ((ftDefaults.factionOverrides as Record<string, Record<string, unknown>>)?.[sel.faction] || {})
    : {} as Record<string, unknown>;
  const frameDefs         = (resolvedTypeCfg.defaults || {}) as Record<string, Partial<ElementSettings>>;

  const elements: ElementDef[] = config.elements || [];
  const settings: Record<string, ElementSettings> = {};
  const values: Record<string, string> = {};

  for (const el of elements) {
    const g   = (G[el.id]                               || {}) as Partial<ElementSettings & { value?: string; url?: string }>;
    const ft  = ((ftDefaults as Record<string, unknown>)[el.id] || {}) as Partial<ElementSettings & { value?: string; url?: string }>;
    const fto = ((ftFactionOverride as Record<string, unknown>)[el.id] || {}) as Partial<ElementSettings & { value?: string; url?: string }>;
    const fr  = (frameDefs[el.id]                       || {}) as Partial<ElementSettings & { value?: string; url?: string }>;
    const d   = (defs[el.id]                            || {}) as Partial<ElementSettings & { value?: string; url?: string }>;

    settings[el.id] = {
      x:           d.x          ?? fr.x          ?? fto.x          ?? ft.x          ?? g.x          ?? 50,
      y:           d.y          ?? fr.y          ?? fto.y          ?? ft.y          ?? g.y          ?? 50,
      fontSize:    d.fontSize   ?? fr.fontSize   ?? fto.fontSize   ?? ft.fontSize   ?? g.fontSize   ?? 18,
      color:       d.color      ?? fr.color      ?? fto.color      ?? ft.color      ?? g.color      ?? '#ffffff',
      maxWidth:    d.maxWidth   ?? fr.maxWidth   ?? fto.maxWidth   ?? ft.maxWidth   ?? g.maxWidth   ?? 85,
      lineHeight:  d.lineHeight ?? fr.lineHeight ?? fto.lineHeight ?? ft.lineHeight ?? g.lineHeight ?? 1.4,
      maxLines:    d.maxLines   ?? fr.maxLines   ?? fto.maxLines   ?? ft.maxLines   ?? g.maxLines   ?? 0,
      x2:          d.x2        ?? fr.x2         ?? fto.x2         ?? ft.x2         ?? g.x2         ?? null,
      maxWidth2:   d.maxWidth2  ?? fr.maxWidth2  ?? fto.maxWidth2  ?? ft.maxWidth2  ?? g.maxWidth2  ?? null,
      size:        d.size       ?? fr.size       ?? fto.size       ?? ft.size       ?? g.size       ?? 10,
      w:           d.w          ?? fr.w          ?? fto.w          ?? ft.w          ?? g.w          ?? null,
      h:           d.h          ?? fr.h          ?? fto.h          ?? ft.h          ?? g.h          ?? null,
      visible:     d.visible    ?? fr.visible    ?? fto.visible    ?? ft.visible    ?? g.visible    ?? true,
      align:       d.align      ?? fr.align      ?? fto.align      ?? ft.align      ?? g.align      ?? el.align ?? 'left',
      fontStyle:   d.fontStyle  ?? fr.fontStyle  ?? fto.fontStyle  ?? ft.fontStyle  ?? g.fontStyle  ?? 'regular',
      textShadow:  d.textShadow ?? fr.textShadow ?? fto.textShadow ?? ft.textShadow ?? g.textShadow ?? null,
      opacity:     d.opacity    ?? fr.opacity    ?? fto.opacity    ?? ft.opacity    ?? g.opacity    ?? 1.0,
      defaultValue: el.inputType === 'qr' ? '' : (d.value ?? fr.value ?? fto.value ?? ft.value ?? g.value ?? ''),
      rectCount:   d.rectCount  ?? fr.rectCount  ?? fto.rectCount  ?? ft.rectCount  ?? g.rectCount  ?? 2,
      rectW:       d.rectW      ?? fr.rectW      ?? fto.rectW      ?? ft.rectW      ?? g.rectW      ?? 18,
      rectH:       d.rectH      ?? fr.rectH      ?? fto.rectH      ?? ft.rectH      ?? g.rectH      ?? 14,
      rectGap:     d.rectGap    ?? fr.rectGap    ?? fto.rectGap    ?? ft.rectGap    ?? g.rectGap    ?? 5,
      rectRadius:  d.rectRadius ?? fr.rectRadius ?? fto.rectRadius ?? ft.rectRadius ?? g.rectRadius ?? 3,
      rectColor:   d.rectColor  ?? fr.rectColor  ?? fto.rectColor  ?? ft.rectColor  ?? g.rectColor  ?? '#ffffff',
      bgVariant:   d.bgVariant  ?? fr.bgVariant  ?? fto.bgVariant  ?? ft.bgVariant  ?? g.bgVariant  ?? 'none',
      bgSize:      d.bgSize     ?? fr.bgSize     ?? fto.bgSize     ?? ft.bgSize     ?? g.bgSize     ?? 8.0,
      bgX:         d.bgX        ?? fr.bgX        ?? fto.bgX        ?? ft.bgX        ?? g.bgX        ?? (d.x ?? fr.x ?? fto.x ?? ft.x ?? g.x ?? 50),
      bgY:         d.bgY        ?? fr.bgY        ?? fto.bgY        ?? ft.bgY        ?? g.bgY        ?? (d.y ?? fr.y ?? fto.y ?? ft.y ?? g.y ?? 50),
      bgW:         d.bgW        ?? fr.bgW        ?? fto.bgW        ?? ft.bgW        ?? g.bgW        ?? 0,
      bgH:         d.bgH        ?? fr.bgH        ?? fto.bgH        ?? ft.bgH        ?? g.bgH        ?? 0,
    };

    values[el.id] = el.inputType === 'qr'
      ? (d.url   || g.url   || '')
      : (d.value || g.value || '');

    if (el.isBiome) {
      const biomeKey = el.biomeKey || el.id;
      const variant  = settings[el.id].bgVariant;
      const biomeCfg = (variant && variant !== 'none')
        ? ((config.biomeBackgrounds?.[biomeKey]?.[variant] as Record<string, unknown> | undefined) || {})
        : {} as Record<string, unknown>;
      if (biomeCfg.bgX      != null && d.bgX      == null) settings[el.id].bgX      = biomeCfg.bgX as number;
      if (biomeCfg.bgY      != null && d.bgY      == null) settings[el.id].bgY      = biomeCfg.bgY as number;
      if (biomeCfg.bgSize   != null && d.bgSize   == null) settings[el.id].bgSize   = biomeCfg.bgSize as number;
      if (biomeCfg.bgW      != null && d.bgW      == null) settings[el.id].bgW      = biomeCfg.bgW as number;
      if (biomeCfg.bgH      != null && d.bgH      == null) settings[el.id].bgH      = biomeCfg.bgH as number;
      if (biomeCfg.textShadow != null && d.textShadow == null) settings[el.id].textShadow = biomeCfg.textShadow as string;
    }
  }

  const overlaySettings: Record<string, OverlaySettings> = {};
  for (const ov of (config.frameParts || [])) {
    const id   = ov.id;
    const base = (ov.default || {}) as Partial<OverlaySettings>;
    const ft   = ((ftDefaults as Record<string, unknown>).frameParts as Record<string, Partial<OverlaySettings>> | undefined)?.[id] || {} as Partial<OverlaySettings>;
    const fto  = (ftFactionOverride.frameParts as Record<string, Partial<OverlaySettings>> | undefined)?.[id] || {} as Partial<OverlaySettings>;
    const fr   = (frameDefs as Record<string, unknown> & { frameParts?: Record<string, Partial<OverlaySettings>> }).frameParts?.[id] || {} as Partial<OverlaySettings>;
    overlaySettings[id] = {
      visible: fr.visible ?? fto.visible ?? ft.visible ?? base.visible ?? false,
      x:       fr.x       ?? fto.x       ?? ft.x       ?? base.x       ?? 50,
      y:       fr.y       ?? fto.y       ?? ft.y       ?? base.y       ?? 50,
      size:    fr.size    ?? fto.size    ?? ft.size    ?? base.size    ?? 15,
    };
  }

  const bgt = (sel.bgTransform || {}) as Partial<BgTransform>;

  return {
    config,
    elements,
    fontNames:         { regular: 'serif', bold: 'serif', italic: 'serif', circled: null },
    images:            { bg: null, frame: null, logo: null, frameParts: {}, adminWatermark: null, qrLogo: null },
    biomeImages:       { forest: {}, mountain: {}, ocean: {} },
    settings,
    values,
    overlaySettings,
    bg:                { zoom: bgt.zoom ?? 100, x: bgt.x ?? 50, y: bgt.y ?? 50, flipX: bgt.flipX ?? false },
    qrSource:          null,
    activeTypeCfg:     resolvedTypeCfg,
    activeFrameTypeId: ftId,
    _qrLogoOverride:   null,
    _isAdmin:          false,
    _ref:              cardJson._ref || '',
  };
}
