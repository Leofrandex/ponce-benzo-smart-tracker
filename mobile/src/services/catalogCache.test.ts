import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCatalogLoad } from './catalogCache';
import type { Product } from '../types';

const p = (id: string): Product => ({ product_id: id, sku: `sku-${id}`, name: `Producto ${id}`, brand: 'Dioxogen' });

test('resolveCatalogLoad prefiere el catalogo online cuando la red respondio', () => {
  const r = resolveCatalogLoad({ ok: true, items: [p('a')] }, [p('b'), p('c')]);
  assert.equal(r.source, 'online');
  assert.deepEqual(r.items.map((i) => i.product_id), ['a']);
});

test('resolveCatalogLoad cae a la cache cuando la red fallo', () => {
  const r = resolveCatalogLoad({ ok: false }, [p('b'), p('c')]);
  assert.equal(r.source, 'cache');
  assert.deepEqual(r.items.map((i) => i.product_id), ['b', 'c']);
});

test('resolveCatalogLoad devuelve vacio cuando no hay red ni cache', () => {
  const r = resolveCatalogLoad({ ok: false }, []);
  assert.equal(r.source, 'empty');
  assert.deepEqual(r.items, []);
});

// Un catalogo online vacio es una respuesta autoritativa ("no hay productos"),
// NO un motivo para resucitar la cache: mismo criterio que resolveRouteLoad.
test('resolveCatalogLoad respeta un catalogo online vacio', () => {
  const r = resolveCatalogLoad({ ok: true, items: [] }, [p('b')]);
  assert.equal(r.source, 'online');
  assert.deepEqual(r.items, []);
});
