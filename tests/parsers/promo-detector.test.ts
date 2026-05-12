import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { detectPromo, detectPromos } from '../../src/parsers/promo-detector.js';
import type { RssItem } from '../../src/parsers/promo-detector.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureXml = readFileSync(join(__dirname, '../fixtures/rss-melhores-destinos.xml'), 'utf-8');

function makeItem(overrides: Partial<RssItem> = {}): RssItem {
  return {
    title: 'LATAM: Executiva para Roma com milhas a partir de 85.000 pontos por trecho!',
    link: 'https://www.melhoresdestinos.com.br/latam-executiva-roma-milhas.html',
    content:
      'A LATAM está com promoção em Executiva de GRU para FCO (Roma) por 85.000 milhas. ' +
      'Válido de junho a setembro de 2027.',
    pubDate: 'Sat, 10 May 2026 09:00:00 +0000',
    ...overrides,
  };
}

describe('detectPromo', () => {
  it('detects a matching LATAM business promo', () => {
    const promo = detectPromo(makeItem());
    expect(promo).not.toBeNull();
    expect(promo?.airline).toBe('LATAM');
    expect(promo?.cabin).toBe('BUSINESS');
    expect(promo?.destination).toBe('FCO');
    expect(promo?.origin).toBe('GRU');
  });

  it('returns null for non-LATAM items', () => {
    const item = makeItem({
      title: 'Iberia com milhas em Executiva para Madrid',
      content: 'Iberia Business Club GRU para MAD com milhas. Boa oportunidade!',
    });
    expect(detectPromo(item)).toBeNull();
  });

  it('returns null when no business class keyword', () => {
    const item = makeItem({
      title: 'LATAM: promoção para Roma em Econômica!',
      content: 'Passagens LATAM para FCO com milhas. R$ 500.',
    });
    expect(detectPromo(item)).toBeNull();
  });

  it('returns null for First Class items (excluded)', () => {
    const item = makeItem({
      title: 'LATAM Primeira Classe / First Class para Roma com milhas',
      content: 'LATAM First Class GRU para FCO com milhas.',
    });
    expect(detectPromo(item)).toBeNull();
  });

  it('returns null when destination not in target list', () => {
    const item = makeItem({
      title: 'LATAM: Executiva para Nova York com milhas!',
      content: 'LATAM Business GRU-JFK com milhas promo.',
    });
    expect(detectPromo(item)).toBeNull();
  });

  it('extracts miles estimate from text', () => {
    const promo = detectPromo(makeItem());
    expect(promo?.milesEstimate).toBe(85000);
  });

  it('extracts price in reais when present', () => {
    const item = makeItem({
      content: 'LATAM Executiva GRU para FCO com milhas. Taxas: R$ 1.800.',
    });
    const promo = detectPromo(item);
    expect(promo?.priceReais).toBe(1800);
  });

  it('detects PREMIUM_BUSINESS cabin', () => {
    const item = makeItem({
      title: 'LATAM Premium Business para Roma com milhas',
      content: 'LATAM Premium Business GRU FCO milhas promo.',
    });
    const promo = detectPromo(item);
    expect(promo?.cabin).toBe('PREMIUM_BUSINESS');
  });

  it('detects MAD as destination', () => {
    const item = makeItem({
      title: 'LATAM Executiva para Madri com milhas promo',
      content: 'LATAM Business GRU para MAD (Madri) com milhas.',
    });
    const promo = detectPromo(item);
    expect(promo?.destination).toBe('MAD');
  });

  it('detects CDG as destination', () => {
    const item = makeItem({
      title: 'LATAM Executiva para Paris com milhas promo',
      content: 'LATAM Business GRU para CDG (Paris) com milhas.',
    });
    const promo = detectPromo(item);
    expect(promo?.destination).toBe('CDG');
  });

  it('sets source to rss', () => {
    const promo = detectPromo(makeItem());
    expect(promo?.source).toBe('rss');
  });

  it('sets detectedAt to approximately now', () => {
    const before = new Date();
    const promo = detectPromo(makeItem());
    const after = new Date();
    expect(promo?.detectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(promo?.detectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('detectPromos (batch)', () => {
  it('uses fixture XML content as sanity check that it contains LATAM keywords', () => {
    expect(fixtureXml).toContain('LATAM');
    expect(fixtureXml).toContain('Executiva');
    expect(fixtureXml).toContain('FCO');
  });

  it('filters only LATAM business promos from a mixed list', () => {
    const mixedItems: RssItem[] = [
      {
        title: 'LATAM: Executiva para Roma com milhas a partir de 85.000 pontos!',
        link: 'https://melhoresdestinos.com.br/latam-executiva-roma.html',
        content: 'A LATAM está com promoção em Executiva de GRU para FCO (Roma) por 85.000 milhas.',
        pubDate: '',
      },
      {
        title: 'Passagens para Orlando em Classe Econômica por R$ 1.999!',
        link: 'https://melhoresdestinos.com.br/orlando.html',
        content: 'Passagens econômicas para Orlando saindo de São Paulo por R$ 1.999.',
        pubDate: '',
      },
      {
        title: 'LATAM: Milhas em Executiva para Paris e Madri — Promo Relâmpago!',
        link: 'https://melhoresdestinos.com.br/latam-paris-madrid.html',
        content:
          'LATAM lançou promoção para Paris (CDG) em classe Executiva com milhas a partir de 90.000.',
        pubDate: '',
      },
      {
        title: 'Passagens para Buenos Aires por R$ 799',
        link: 'https://melhoresdestinos.com.br/buenos-aires.html',
        content: 'Buenos Aires com passagens em promoção.',
        pubDate: '',
      },
      {
        title: 'LATAM Primeira Classe / First Class para Los Angeles',
        link: 'https://melhoresdestinos.com.br/latam-first-la.html',
        content: 'LATAM First Class para LAX com milhas.',
        pubDate: '',
      },
    ];

    const promos = detectPromos(mixedItems);
    expect(promos.length).toBeGreaterThanOrEqual(2);
    expect(promos.every((p) => p.airline === 'LATAM')).toBe(true);
    expect(promos.every((p) => ['BUSINESS', 'PREMIUM_BUSINESS'].includes(p.cabin))).toBe(true);
  });
});
