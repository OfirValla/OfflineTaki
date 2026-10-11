import {
  ALL_COLORS,
  CardKind,
  cardColor,
  isNumberCard,
  isWildCard,
} from '../cards/Card';
import { buildDeck } from '../cards/deck';
import { createRng, nextInt, shuffle } from '../engine/rng';

describe('deck', () => {
  const deck = buildDeck();

  it('has 100 cards in the default composition', () => {
    expect(deck).toHaveLength(100);
    expect(deck.filter(isNumberCard)).toHaveLength(64);
    expect(deck.filter(isWildCard)).toHaveLength(4);
    expect(deck.filter(c => c.kind === CardKind.Stop)).toHaveLength(8);
    expect(deck.filter(c => c.kind === CardKind.Plus)).toHaveLength(8);
    expect(deck.filter(c => c.kind === CardKind.ChangeDirection)).toHaveLength(
      8,
    );
    expect(deck.filter(c => c.kind === CardKind.Taki)).toHaveLength(8);
    for (const color of ALL_COLORS) {
      expect(deck.filter(c => cardColor(c) === color)).toHaveLength(24);
    }
  });

  it('has no 2 and no 0', () => {
    const values = new Set(deck.filter(isNumberCard).map(c => c.value));
    expect(values.has(2 as never)).toBe(false);
    expect(values.has(0 as never)).toBe(false);
    expect([...values].sort((a, b) => a - b)).toEqual([1, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('gives every card a unique, readable id', () => {
    const ids = deck.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('red-7-a');
    expect(ids).toContain('blue-stop-b');
    expect(ids).toContain('wild-change-color-4');
  });

  it('supports other compositions', () => {
    expect(buildDeck({ copies: 1, changeColorCards: 2 })).toHaveLength(50);
    expect(() => buildDeck({ copies: 0, changeColorCards: 0 })).toThrow();
  });
});

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = shuffle(buildDeck(), createRng(1234));
    const b = shuffle(buildDeck(), createRng(1234));
    expect(a.items.map(c => c.id)).toEqual(b.items.map(c => c.id));
    expect(a.next).toEqual(b.next);
  });

  it('produces different orders for different seeds and keeps every card', () => {
    const a = shuffle(buildDeck(), createRng(1));
    const b = shuffle(buildDeck(), createRng(2));
    expect(a.items.map(c => c.id)).not.toEqual(b.items.map(c => c.id));
    expect(a.items.map(c => c.id).sort()).toEqual(
      buildDeck()
        .map(c => c.id)
        .sort(),
    );
  });

  it('draws integers inside the requested range', () => {
    let rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const draw = nextInt(rng, 6);
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(6);
      rng = draw.next;
    }
  });
});
