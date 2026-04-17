import { describe, it, expect } from 'vitest';
import { buildStateFromJson } from '../state';
import type { ForgeConfig, CardJson } from '../types';

const baseConfig: ForgeConfig = {
  elements: [
    { id: 'cardName', inputType: 'text', align: 'left' },
    { id: 'effects',  inputType: 'richtext', align: 'left' },
    { id: 'qrCode',   inputType: 'qr', align: 'left' },
  ],
  globalDefaults: {
    cardName: { fontSize: 24, color: '#ffffff', x: 10, y: 20 },
  },
  frameTypes: {},
  frameParts: [],
  factions: {},
  setLogos: [],
};

const emptyCardJson: CardJson = {
  _type: 'card-config',
  _ref: 'TEST_001',
  _selection: { faction: '', type: '', collection: 'official', setCode: null },
  globalDefaults: {},
};

describe('buildStateFromJson', () => {
  it('builds a valid CardState from minimal config', () => {
    const state = buildStateFromJson(baseConfig, emptyCardJson);
    expect(state.elements).toHaveLength(3);
    expect(state.config).toBe(baseConfig);
    expect(state._ref).toBe('TEST_001');
  });

  it('applies globalDefaults from config', () => {
    const state = buildStateFromJson(baseConfig, emptyCardJson);
    expect(state.settings.cardName.fontSize).toBe(24);
    expect(state.settings.cardName.color).toBe('#ffffff');
    expect(state.settings.cardName.x).toBe(10);
    expect(state.settings.cardName.y).toBe(20);
  });

  it('cardJson overrides config globalDefaults', () => {
    const cardJson: CardJson = {
      ...emptyCardJson,
      globalDefaults: {
        cardName: { fontSize: 36, value: 'My Card' },
      },
    };
    const state = buildStateFromJson(baseConfig, cardJson);
    expect(state.settings.cardName.fontSize).toBe(36);
    expect(state.values.cardName).toBe('My Card');
  });

  it('uses default values when nothing is specified', () => {
    const cfg: ForgeConfig = { ...baseConfig, globalDefaults: {}, elements: [{ id: 'cardName', inputType: 'text', align: 'left' }] };
    const state = buildStateFromJson(cfg, emptyCardJson);
    expect(state.settings.cardName.fontSize).toBe(18);
    expect(state.settings.cardName.color).toBe('#ffffff');
    expect(state.settings.cardName.visible).toBe(true);
    expect(state.settings.cardName.opacity).toBe(1.0);
  });

  it('sets empty defaultValue for qr elements', () => {
    const state = buildStateFromJson(baseConfig, emptyCardJson);
    expect(state.settings.qrCode.defaultValue).toBe('');
  });

  it('stores QR URL from cardJson', () => {
    const cardJson: CardJson = {
      ...emptyCardJson,
      globalDefaults: { qrCode: { url: 'https://example.com' } },
    };
    const state = buildStateFromJson(baseConfig, cardJson);
    expect(state.values.qrCode).toBe('https://example.com');
  });

  it('initializes empty images object', () => {
    const state = buildStateFromJson(baseConfig, emptyCardJson);
    expect(state.images.bg).toBeNull();
    expect(state.images.frame).toBeNull();
    expect(state.images.logo).toBeNull();
    expect(state.images.frameParts).toEqual({});
  });

  it('initializes default bgTransform from _selection', () => {
    const cardJson: CardJson = {
      ...emptyCardJson,
      _selection: { ...emptyCardJson._selection, bgTransform: { zoom: 150, x: 60, y: 40 } },
    };
    const state = buildStateFromJson(baseConfig, cardJson);
    expect(state.bg.zoom).toBe(150);
    expect(state.bg.x).toBe(60);
    expect(state.bg.y).toBe(40);
  });

  it('falls back to default bgTransform when not specified', () => {
    const state = buildStateFromJson(baseConfig, emptyCardJson);
    expect(state.bg.zoom).toBe(100);
    expect(state.bg.x).toBe(50);
    expect(state.bg.y).toBe(50);
    expect(state.bg.flipX).toBe(false);
  });

  it('frameType defaults override config globalDefaults', () => {
    const cfg: ForgeConfig = {
      ...baseConfig,
      frameTypes: {
        hero: {
          cardName: { fontSize: 30 },
        },
      },
      factions: {
        AX: {
          types: {
            'official::hero': { frameType: 'hero', collection: 'official', defaults: {} },
          },
        },
      },
    };
    const cardJson: CardJson = {
      ...emptyCardJson,
      _selection: { faction: 'AX', type: 'official::hero', collection: 'official', setCode: null },
    };
    const state = buildStateFromJson(cfg, cardJson);
    expect(state.settings.cardName.fontSize).toBe(30);
  });

  it('cardJson overrides take highest priority', () => {
    const cfg: ForgeConfig = {
      ...baseConfig,
      frameTypes: { hero: { cardName: { fontSize: 30 } } },
      factions: {
        AX: {
          types: {
            'official::hero': { frameType: 'hero', collection: 'official', defaults: {} },
          },
        },
      },
    };
    const cardJson: CardJson = {
      ...emptyCardJson,
      _selection: { faction: 'AX', type: 'official::hero', collection: 'official', setCode: null },
      globalDefaults: { cardName: { fontSize: 48 } },
    };
    const state = buildStateFromJson(cfg, cardJson);
    expect(state.settings.cardName.fontSize).toBe(48);
  });
});
