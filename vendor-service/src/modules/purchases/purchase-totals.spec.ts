import { computeTotals } from './purchase-totals';

/** The ladder is money arithmetic, so it gets pinned to worked examples. */
describe('computeTotals — bill footer ladder', () => {
  const oneLakh = {
    items: [{ quantity: '100', unit_price: '1000' }],
  };

  it('cascades each rung onto what the previous one left', () => {
    const t = computeTotals({
      ...oneLakh,
      deductions: [
        { code: 'WHOLESALE', label: 'Wholesale discount', basis: 'PERCENT', value: '10' },
        { code: 'RETAIL_SCHEME', label: 'Retail scheme', basis: 'PERCENT', value: '5' },
        { code: 'TRADE', label: 'Trade discount', basis: 'PERCENT', value: '2' },
      ],
      igst_rate: '12',
      rounding: 'NORMAL',
    });

    expect(t.subtotal.toFixed(2)).toBe('100000.00');
    expect(t.deductions.map((d) => d.amount.toFixed(2))).toEqual([
      '10000.00', // 10% of 1,00,000
      '4500.00', //  5% of    90,000
      '1710.00', //  2% of    85,500
    ]);
    expect(t.discount.toFixed(2)).toBe('16210.00');
    expect(t.taxable_amount.toFixed(2)).toBe('83790.00');
    expect(t.igst.toFixed(2)).toBe('10054.80');
    // 93,844.80 half-up to the rupee goes to 93,845, so the adjustment is
    // positive: twenty paise is added, not eighty taken off.
    expect(t.round_off.toFixed(2)).toBe('0.20');
    expect(t.total_amount.toFixed(2)).toBe('93845.00');
  });

  it('is not the same as summing the percentages', () => {
    const cascaded = computeTotals({
      ...oneLakh,
      deductions: [
        { code: 'A', label: 'A', basis: 'PERCENT', value: '10' },
        { code: 'B', label: 'B', basis: 'PERCENT', value: '5' },
        { code: 'C', label: 'C', basis: 'PERCENT', value: '2' },
      ],
    });
    const flat = computeTotals({
      ...oneLakh,
      deductions: [{ code: 'A', label: 'A', basis: 'PERCENT', value: '17' }],
    });

    expect(cascaded.taxable_amount.toFixed(2)).toBe('83790.00');
    expect(flat.taxable_amount.toFixed(2)).toBe('83000.00');
  });

  it('takes a GROSS rung off the subtotal, not the running balance', () => {
    const t = computeTotals({
      ...oneLakh,
      deductions: [
        { code: 'A', label: 'A', basis: 'PERCENT', value: '10' },
        { code: 'B', label: 'B', basis: 'PERCENT', applies_to: 'GROSS', value: '5' },
      ],
    });

    expect(t.deductions[1].amount.toFixed(2)).toBe('5000.00'); // 5% of gross
    expect(t.taxable_amount.toFixed(2)).toBe('85000.00');
  });

  it('mixes amount and percentage rungs', () => {
    const t = computeTotals({
      ...oneLakh,
      deductions: [
        { code: 'TRADE', label: 'Trade', basis: 'PERCENT', value: '10' },
        { code: 'SETTLE', label: 'Settlement', basis: 'AMOUNT', value: '2500' },
      ],
    });

    expect(t.taxable_amount.toFixed(2)).toBe('87500.00');
  });

  it('never drives a bill below zero', () => {
    const t = computeTotals({
      ...oneLakh,
      deductions: [
        { code: 'A', label: 'A', basis: 'AMOUNT', value: '90000' },
        { code: 'B', label: 'B', basis: 'AMOUNT', value: '90000' },
      ],
    });

    expect(t.deductions[1].amount.toFixed(2)).toBe('10000.00'); // clamped
    expect(t.taxable_amount.toFixed(2)).toBe('0.00');
    expect(t.total_amount.toFixed(2)).toBe('0.00');
  });

  it('splits intra-state tax across CGST and SGST on the discounted value', () => {
    const t = computeTotals({
      ...oneLakh,
      deductions: [{ code: 'TRADE', label: 'Trade', basis: 'PERCENT', value: '10' }],
      cgst_rate: '6',
      sgst_rate: '6',
    });

    expect(t.taxable_amount.toFixed(2)).toBe('90000.00');
    expect(t.cgst.toFixed(2)).toBe('5400.00');
    expect(t.sgst.toFixed(2)).toBe('5400.00');
    expect(t.total_amount.toFixed(2)).toBe('100800.00');
  });

  it('rounds up, down and to fifty paise', () => {
    const base = { items: [{ quantity: '1', unit_price: '100.40' }] };

    expect(
      computeTotals({ ...base, rounding: 'UP' }).total_amount.toFixed(2),
    ).toBe('101.00');
    expect(
      computeTotals({ ...base, rounding: 'DOWN' }).total_amount.toFixed(2),
    ).toBe('100.00');
    expect(
      computeTotals({
        ...base,
        rounding: 'NORMAL',
        rounding_precision: '0.50',
      }).total_amount.toFixed(2),
    ).toBe('100.50');
  });

  it('leaves the total alone when rounding is off', () => {
    const t = computeTotals({
      items: [{ quantity: '1', unit_price: '100.40' }],
    });
    expect(t.round_off.toFixed(2)).toBe('0.00');
    expect(t.total_amount.toFixed(2)).toBe('100.40');
  });
});
