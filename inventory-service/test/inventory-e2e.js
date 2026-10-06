/**
 * End-to-end smoke test: registers a fresh user on auth-service (which also
 * provisions a tenant), then drives the inventory API through the garment
 * example from the spec: variant types -> product with variants and sizes
 * -> receive -> transfer -> issue -> ledger. Run with both services up:
 *   npm run test:e2e:http
 */
const AUTH = process.env.AUTH_URL || 'http://localhost:3001';
const INV = process.env.INVENTORY_URL || 'http://localhost:3002';

const out = [];
const log = (s) => out.push(s);
let failures = 0;
const check = (name, cond, detail) => {
  if (!cond) failures++;
  log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

let token = '';
async function call(base, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let d = null;
  try {
    d = text ? JSON.parse(text) : null;
  } catch {
    d = text;
  }
  return { ok: res.ok, status: res.status, d };
}
const inv = (m, p, b) => call(INV, m, p, b);

(async () => {
  // ── setup: user + tenant on auth-service ──────────────────────────────
  const email = `inv${Date.now()}@example.com`;
  let r = await call(AUTH, 'POST', '/auth/register', {
    email,
    password: 'Password@123',
    name: 'Inventory Test',
  });
  check('setup: registered', r.ok, r.ok ? '' : JSON.stringify(r.d));
  await call(AUTH, 'POST', '/auth/verify-email', { token: r.d?.verificationToken });
  r = await call(AUTH, 'POST', '/auth/login', { email, password: 'Password@123' });
  token = r.d?.accessToken ?? '';
  check('setup: logged in with a tenant-bearing token', !!token);

  // ── 1. unauthenticated is rejected ────────────────────────────────────
  const saved = token;
  token = '';
  r = await inv('GET', '/products');
  check('GET /products without token -> 401', r.status === 401);
  token = saved;

  // ── 2. variant types: fields, one of which may split stock ────────────
  r = await inv('POST', '/variant-types', {
    key: 'sized-apparel',
    name: 'Sized apparel',
    attribute_schema: {
      type: 'object',
      properties: {
        colour: { type: 'string' },
        size: { type: 'string', title: 'Size', enum: ['S', 'M', 'L', 'XL'] },
      },
      required: ['colour', 'size'],
    },
    axis_key: 'size',
  });
  check('create variant type whose Size field splits stock',
    r.ok && r.d?.axis_label === 'Size' && r.d?.axis_values?.length === 4 && r.d?.axis_free === false,
    r.ok ? '' : JSON.stringify(r.d));
  const sizedType = r.d?.id;

  r = await inv('POST', '/variant-types', {
    key: 'bottled',
    name: 'Bottled',
    attribute_schema: {
      type: 'object',
      properties: { capacity: { type: 'string', title: 'Capacity' } },
    },
    axis_key: 'capacity',
  });
  check('a text field can split stock too (free values)', r.ok && r.d?.axis_label === 'Capacity' && r.d?.axis_free === true);
  const bottledType = r.d?.id;

  r = await inv('POST', '/variant-types', { key: 'single', name: 'Single item' });
  check('create single-unit variant type (no axis)', r.ok && r.d?.axis_label === null);
  const singleType = r.d?.id;

  r = await inv('POST', '/variant-types', { key: 'sized-apparel', name: 'Dup' });
  check('duplicate variant type key -> 409', r.status === 409);
  r = await inv('POST', '/variant-types', { key: 'bad-axis', name: 'Bad', axis_key: 'nope' });
  check('axis_key that is not a field -> 400', r.status === 400);
  r = await inv('POST', '/variant-types', {
    key: 'bad-axis-type', name: 'Bad',
    attribute_schema: { type: 'object', properties: { qty: { type: 'integer' } } },
    axis_key: 'qty',
  });
  check('axis on a number field -> 400', r.status === 400);
  r = await inv('POST', '/variant-types', { key: 'broken', name: 'Broken', attribute_schema: { type: 'not-a-type' } });
  check('invalid JSON Schema -> 400', r.status === 400);

  // ── 4. product validation ─────────────────────────────────────────────
  r = await inv('POST', '/products', {
    name: 'Boyleg Brief',
    attributes: { hsn: 6107 },
    variants: [{ name: 'Navy', variant_type_id: sizedType, sizes: [{ label: 'S' }] }],
  });
  check('missing required variant attribute (colour) -> 400', r.status === 400,
    JSON.stringify(r.d?.errors ?? r.d?.message));

  r = await inv('POST', '/products', {
    name: 'Boyleg Brief',
    attributes: { hsn: 6107 },
    variants: [{ name: 'Navy', variant_type_id: sizedType, attributes: { colour: 'navy' }, sizes: [{ label: 'XXL' }] }],
  });
  check('value outside the axis field choices -> 400 (strict)', r.status === 400, r.d?.message);

  r = await inv('POST', '/products', {
    name: 'Boyleg Brief',
    attributes: { hsn: 6107 },
    variants: [{ name: 'Navy', variant_type_id: sizedType, attributes: { colour: 'navy' } }],
  });
  check('typed variant with an axis but no sizes -> 400', r.status === 400, r.d?.message);
  check('…and the axis field itself is not demanded in attributes', !/size/.test(JSON.stringify(r.d?.errors ?? '')));

  r = await inv('POST', '/products', { name: 'No variants' });
  check('product without variants -> 400', r.status === 400);

  r = await inv('POST', '/products', {
    name: 'No name',
    variants: [{ sizes: [{ label: 'S' }] }],
  });
  check('variant without name -> 400', r.status === 400);

  // One product mixing variant types: sized apparel + a free-capacity bottle + a single-unit pack.
  r = await inv('POST', '/products', {
    name: 'Boyleg Brief',
    code: '1001',
    tags: ['innerwear', 'boys'],
    attributes: { hsn: 6107, fabric: 'cotton' },
    variants: [
      {
        name: '1001 NAVY',
        variant_type_id: sizedType,
        attributes: { colour: 'navy' },
        sizes: [
          { label: 'S', sku: '1001-NAVY-S', cost_price: '80', sell_price: '120', barcodes: [{ value: `890${Date.now()}1`, type: 'EAN13' }] },
          { label: 'M', sku: '1001-NAVY-M', cost_price: '80', sell_price: '120' },
          { label: 'L', sku: '1001-NAVY-L', cost_price: '85', sell_price: '130' },
        ],
      },
      {
        name: '1001 WHITE',
        variant_type_id: sizedType,
        attributes: { colour: 'white' },
        sizes: [{ label: 'M' }, { label: 'L', sell_price: '125' }],
      },
      {
        name: 'Gift pack of 3',
        variant_type_id: singleType,
        sizes: [{ sku: '1001-PACK3', cost_price: '240', sell_price: '330' }],
      },
      {
        name: 'Fabric softener',
        variant_type_id: bottledType,
        sizes: [{ label: '250 ml', sell_price: '90' }, { label: '1 l', sell_price: '300' }],
      },
    ],
  });
  const product = r.d;
  check('create product mixing sized + single-unit + free-axis variants',
    r.ok && product?.variants?.length === 4, r.ok ? '' : JSON.stringify(r.d));
  const navy = product?.variants?.find((v) => v.name === '1001 NAVY');
  const white = product?.variants?.find((v) => v.name === '1001 WHITE');
  const pack = product?.variants?.find((v) => v.name === 'Gift pack of 3');
  check('sized variant has 3 sizes, priced per size',
    navy?.sizes?.length === 3 && navy.sizes.find((s) => s.label === 'L')?.sell_price === '130');
  check('prices are optional (white M has none)',
    white?.sizes?.find((s) => s.label === 'M')?.sell_price === null);
  check('single-unit variant got one "Default" size with the pack price',
    pack?.sizes?.length === 1 && pack.sizes[0].label === 'Default' && pack.sizes[0].sell_price === '330');
  check('variant carries its type with the axis described', navy?.variant_type?.axis_label === 'Size' && navy?.variant_type?.axis_key === 'size');
  const bottle = product?.variants?.find((v) => v.name === 'Fabric softener');
  check('free-axis variant accepted any capacity labels', bottle?.sizes?.map((x) => x.label).join('|') === '250 ml|1 l');

  const sS = navy?.sizes?.find((s) => s.label === 'S');
  const sM = navy?.sizes?.find((s) => s.label === 'M');
  const ean = sS?.barcodes?.[0]?.value;

  r = await inv('POST', '/products', {
    name: 'Dup variant names',
    variants: [{ name: 'A', sizes: [{ label: 'One' }] }, { name: 'A', sizes: [{ label: 'Two' }] }],
  });
  check('duplicate variant name in one product -> 400', r.status === 400);

  r = await inv('POST', '/products', {
    name: 'Untyped thing',
    attributes: { anything: [1, 2, 3] },
    variants: [{ name: 'Plain', sizes: [{ label: 'Small' }, { label: 'Big' }] }],
  });
  check('untyped product/variant accepts any attributes and free sizes',
    r.ok && r.d?.variants?.[0]?.sizes?.length === 2);

  // ── 5. sizes and variants after the fact ──────────────────────────────
  r = await inv('POST', `/variants/${navy?.id}/sizes`, { label: 'XL', cost_price: '90', sell_price: '140' });
  check('add XL to navy (on the list)', r.ok && r.d?.label === 'XL');
  const sXL = r.d;
  r = await inv('POST', `/variants/${navy?.id}/sizes`, { label: 'XXL' });
  check('add XXL to navy (not on the list) -> 400', r.status === 400);
  r = await inv('POST', `/variants/${navy?.id}/sizes`, { label: 'M' });
  check('add M twice -> 409', r.status === 409);
  r = await inv('POST', `/variants/${pack?.id}/sizes`, { label: 'Big' });
  check('add a size to a single-unit variant -> 400', r.status === 400);
  r = await inv('PATCH', `/sizes/${sM?.id}`, { cost_price: '82.5' });
  check('price can be set later on a size', r.ok && r.d?.cost_price === '82.5');
  r = await inv('DELETE', `/sizes/${sXL?.id}`);
  check('remove XL', r.ok);
  r = await inv('DELETE', `/sizes/${pack?.sizes?.[0]?.id}`);
  check('last size of a variant cannot be removed -> 409', r.status === 409);

  r = await inv('POST', `/products/${product?.id}/variants`, {
    name: '1001 BLACK',
    variant_type_id: sizedType,
    attributes: { colour: 'black' },
    sizes: [{ label: 'S' }, { label: 'M' }],
  });
  check('add a variant to an existing product', r.ok && r.d?.sizes?.length === 2);
  const black = r.d;
  r = await inv('PATCH', `/variants/${black?.id}`, { variant_type_id: singleType });
  check('switching a 2-size variant to a single-unit type -> 400', r.status === 400, r.d?.message);
  r = await inv('DELETE', `/variants/${black?.id}`);
  check('remove the added variant', r.ok);

  r = await inv('DELETE', `/variant-types/${sizedType}`);
  check('variant type in use cannot be deleted -> 409', r.status === 409);

  // ── 6. lookup + filters ───────────────────────────────────────────────
  r = await inv('GET', `/sizes/lookup?barcode=${encodeURIComponent(ean)}`);
  check('barcode lookup resolves the size (with its variant + product)',
    r.ok && r.d?.id === sS?.id && r.d?.variant?.product?.id === product?.id);

  r = await inv('GET', '/products?attr[fabric]=cotton');
  check('attr[fabric]=cotton filter finds the product',
    r.ok && r.d?.items?.some((p) => p.id === product?.id) && r.d.total === 1,
    `total=${r.d?.total}`);

  r = await inv('GET', '/products?q=1001-NAVY-M');
  check('q= matches on size sku', r.ok && r.d?.total === 1);
  r = await inv('GET', '/products?q=WHITE');
  check('q= matches on variant name', r.ok && r.d?.total === 1);

  // ── 7. locations ──────────────────────────────────────────────────────
  r = await inv('GET', '/locations');
  const main = r.d?.find?.((l) => l.is_default);
  check('default location auto-created', !!main, main?.code);

  r = await inv('POST', '/locations', { code: 'WH2', name: 'Second warehouse' });
  check('create second location', r.ok);
  const wh2 = r.d?.id;

  r = await inv('DELETE', `/locations/${main?.id}`);
  check('default location cannot be deleted -> 409', r.status === 409);

  // ── 8. stock movements, per size ──────────────────────────────────────
  r = await inv('POST', '/stock/movements', { size_id: sS.id, type: 'IN', quantity: '10', reference_type: 'purchase', reference_id: 'PO-1' });
  check('IN 10 (navy S) to default', r.ok, r.ok ? '' : JSON.stringify(r.d));

  r = await inv('POST', '/stock/movements', { size_id: sS.id, type: 'TRANSFER', quantity: '4', to_location_id: wh2 });
  check('TRANSFER 4 default -> WH2', r.ok, r.ok ? '' : JSON.stringify(r.d));

  r = await inv('POST', '/stock/movements', { size_id: sS.id, type: 'OUT', quantity: '7' });
  check('OUT 7 from default (only 6) -> 409', r.status === 409, r.d?.message);

  r = await inv('POST', '/stock/movements', { size_id: sS.id, type: 'OUT', quantity: '6', reference_type: 'order', reference_id: 'SO-1' });
  check('OUT 6 from default', r.ok, r.ok ? '' : JSON.stringify(r.d));

  r = await inv('GET', `/sizes/${sS.id}/stock`);
  const byLoc = Object.fromEntries((r.d?.levels ?? []).map((l) => [l.location.code, l.quantity]));
  check('levels: MAIN=0, WH2=4, total 4',
    Number(byLoc.MAIN) === 0 && Number(byLoc.WH2) === 4 && Number(r.d?.totals?.quantity) === 4,
    JSON.stringify(byLoc));

  r = await inv('GET', `/stock/movements?size=${sS.id}`);
  check('ledger has 3 rows for the size', r.d?.total === 3, `total=${r.d?.total}`);
  r = await inv('GET', `/stock/movements?variant=${navy.id}`);
  check('ledger filters by variant too', r.d?.total === 3 && r.d?.items?.[0]?.size?.variant?.name === '1001 NAVY');

  // reserve / release
  r = await inv('POST', '/stock/reserve', { size_id: sS.id, location_id: wh2, quantity: '3' });
  check('reserve 3 at WH2', r.ok && Number(r.d?.reserved) === 3);
  r = await inv('POST', '/stock/movements', { size_id: sS.id, type: 'OUT', quantity: '2', from_location_id: wh2 });
  check('OUT 2 at WH2 with 1 available -> 409', r.status === 409);
  r = await inv('POST', '/stock/release', { size_id: sS.id, location_id: wh2, quantity: '3' });
  check('release 3', r.ok && Number(r.d?.reserved) === 0);

  // adjust by count
  r = await inv('POST', '/stock/movements', { size_id: sS.id, type: 'ADJUST', counted: '9', from_location_id: wh2, reason: 'stock take' });
  check('ADJUST counted=9 records previous=4', r.ok && r.d?.movement?.payload?.previous === '4' && Number(r.d?.movement?.quantity) === 5,
    JSON.stringify(r.d?.movement?.payload));

  // reorder threshold
  r = await inv('PUT', '/stock/reorder', { size_id: sM.id, reorder_at: '5' });
  check('set reorder_at on navy M', r.ok);
  r = await inv('GET', '/stock?below_reorder=true');
  check('below_reorder lists navy M (0 < 5)', r.ok && r.d?.items?.some((l) => l.size.id === sM.id));
  r = await inv('GET', `/stock?product=${product.id}`);
  check('stock list filters by product', r.ok && r.d?.items?.every((l) => l.size.variant.product.id === product.id));

  // concurrency: 10 parallel OUTs for the last unit, exactly one wins
  r = await inv('POST', '/stock/movements', { size_id: sM.id, type: 'IN', quantity: '1' });
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      inv('POST', '/stock/movements', { size_id: sM.id, type: 'OUT', quantity: '1' }),
    ),
  );
  const wins = results.filter((x) => x.ok).length;
  check('10 parallel OUTs for 1 unit -> exactly 1 succeeds', wins === 1, `wins=${wins}`);

  // ── 9. product summary + cleanup ──────────────────────────────────────
  r = await inv('GET', `/products/${product.id}`);
  const navyNow = r.d?.variants?.find((v) => v.id === navy.id);
  check('product detail sums stock across variants and sizes (9)', Number(r.d?.stock?.quantity) === 9, r.d?.stock?.quantity);
  check('variant total = sum of its sizes (9)', Number(navyNow?.stock_totals?.quantity) === 9);

  r = await inv('PATCH', `/variant-types/${sizedType}`, {
    attribute_schema: {
      type: 'object',
      properties: { colour: { type: 'string' }, size: { type: 'string', title: 'Size', enum: ['S', 'M'] } },
      required: ['colour'],
    },
  });
  check('shrinking the axis choices is allowed', r.ok && r.d?.axis_values?.length === 2);
  r = await inv('GET', `/variant-types/${sizedType}/violations`);
  check('…and reported as violations (navy L, white L)', r.ok && r.d?.count === 2, `count=${r.d?.count}`);

  r = await inv('DELETE', `/products/${product.id}`);
  check('soft delete product', r.ok);
  r = await inv('GET', `/products/${product.id}`);
  check('deleted product is gone -> 404', r.status === 404);

  console.log(out.join('\n'));
  console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.log(out.join('\n'));
  console.error('CRASH', e);
  process.exit(1);
});
