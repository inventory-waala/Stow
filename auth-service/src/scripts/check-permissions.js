#!/usr/bin/env node
/**
 * Keeps the permission catalogue honest against the services that consume it.
 *
 * inventory-service, vendor-service and transaction-service each pass their
 * own string literals to `@Protected(...)`, and their PermissionsGuard tests
 * them against the `permissions` claim this service signs. The two lists are
 * only connected by convention, so this checks them:
 *
 *   - a literal used by a service but missing from the catalogue can never be
 *     granted, so that role silently cannot do the thing  -> failure
 *   - a catalogue entry nothing checks is either an auth-side permission or
 *     dead weight                                         -> reported only
 *
 * Run with `npm run permissions:check`.
 */
const fs = require('fs');
const path = require('path');

const SERVICE_ROOT = path.resolve(__dirname, '..', '..');
const MONOREPO_ROOT = path.resolve(SERVICE_ROOT, '..');

const CATALOGUE = path.join(
  SERVICE_ROOT,
  'src',
  'modules',
  'permissions',
  'permissions.catalogue.ts',
);

/** Permissions this service enforces itself; no other service checks them. */
const AUTH_OWNED = /^(team|workspace|reports)\./;

const CONSUMERS = ['inventory-service', 'vendor-service', 'transaction-service'];

function catalogueNames() {
  const source = fs.readFileSync(CATALOGUE, 'utf8');
  const body = source.slice(
    source.indexOf('PERMISSION_CATALOGUE'),
    source.indexOf('PERMISSION_NAMES'),
  );
  const names = new Set();
  for (const match of body.matchAll(/name:\s*'([^']+)'/g)) names.add(match[1]);
  return names;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') walk(full, files);
    } else if (entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const PERMISSION_LITERAL = /^[a-z]+\.[a-z_]+$/;

/**
 * What each consumer service enforces. Every one of them declares its
 * vocabulary as a `Perm` map in src/auth/decorators/permissions.decorator.ts
 * and passes those constants to `@Protected(...)`, so the map is the list to
 * compare -- plus any literal passed inline, which the map would miss.
 */
function usedPermissions() {
  const used = new Map(); // name -> Set<service>

  const record = (name, service) => {
    if (!used.has(name)) used.set(name, new Set());
    used.get(name).add(service);
  };

  for (const service of CONSUMERS) {
    const src = path.join(MONOREPO_ROOT, service, 'src');
    if (!fs.existsSync(src)) continue;

    const decorators = path.join(
      src,
      'auth',
      'decorators',
      'permissions.decorator.ts',
    );
    if (!fs.existsSync(decorators)) {
      console.error(
        `
${service} has no src/auth/decorators/permissions.decorator.ts; ` +
          `this check cannot see what it enforces.`,
      );
      process.exit(1);
    }
    const source = fs.readFileSync(decorators, 'utf8');
    const map = source.slice(source.indexOf('Perm = {'));
    for (const literal of map.matchAll(/'([^']+)'/g)) {
      if (PERMISSION_LITERAL.test(literal[1])) record(literal[1], service);
    }

    for (const file of walk(src)) {
      const contents = fs.readFileSync(file, 'utf8');
      for (const call of contents.matchAll(
        /(?:@Protected|RequirePermissions)\(([^)]*)\)/g,
      )) {
        for (const literal of call[1].matchAll(/'([^']+)'/g)) {
          if (PERMISSION_LITERAL.test(literal[1])) record(literal[1], service);
        }
      }
    }
  }
  return used;
}

const catalogue = catalogueNames();
const used = usedPermissions();

const missing = [...used.keys()].filter((name) => !catalogue.has(name));
const unused = [...catalogue].filter(
  (name) => !used.has(name) && !AUTH_OWNED.test(name),
);

console.log(
  `catalogue: ${catalogue.size} permission(s); services check ${used.size}`,
);

if (unused.length > 0) {
  console.log(`\nIn the catalogue but checked by no service:`);
  for (const name of unused) console.log(`  - ${name}`);
}

if (missing.length > 0) {
  console.error(`\nChecked by a service but missing from the catalogue:`);
  for (const name of missing) {
    console.error(`  - ${name}  (${[...used.get(name)].join(', ')})`);
  }
  console.error(
    `\nAdd them to permissions.catalogue.ts, or no role will ever be able to use them.`,
  );
  process.exit(1);
}

console.log('\nEvery permission the services check exists in the catalogue.');
