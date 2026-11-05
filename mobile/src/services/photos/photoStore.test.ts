import test from 'node:test';
import assert from 'node:assert/strict';
import { persistPhoto, deletePhotos, photoExists, type PhotoFs } from './photoStore';

function fakeFs(existing: string[], opts: { copyFails?: boolean; removeFails?: boolean } = {}) {
  const removed: string[] = [];
  const fs: PhotoFs & { removed: string[] } = {
    removed,
    async ensureDir() {},
    async copyToPermanent(_uri, name) {
      if (opts.copyFails) throw new Error('copy failed');
      return `file:///perm/${name}`;
    },
    async exists(uri) { return existing.includes(uri); },
    async remove(uri) {
      if (opts.removeFails) throw new Error('remove failed');
      removed.push(uri);
    },
    async list() { return []; },
  };
  return fs;
}

test('persistPhoto copia, borra el original y devuelve la ruta permanente', async () => {
  const fs = fakeFs(['file:///cache/a.jpg']);
  const uri = await persistPhoto('file:///cache/a.jpg', fs);
  assert.match(uri, /^file:\/\/\/perm\//);
  assert.deepEqual(fs.removed, ['file:///cache/a.jpg']);
});

test('persistPhoto: si falla la copia usa la ruta original y no borra nada', async () => {
  const fs = fakeFs(['file:///cache/a.jpg'], { copyFails: true });
  assert.equal(await persistPhoto('file:///cache/a.jpg', fs), 'file:///cache/a.jpg');
  assert.deepEqual(fs.removed, []);
});

test('persistPhoto: si falla borrar el original igual devuelve la copia', async () => {
  const fs = fakeFs(['file:///cache/a.jpg'], { removeFails: true });
  assert.match(await persistPhoto('file:///cache/a.jpg', fs), /^file:\/\/\/perm\//);
});

test('deletePhotos ignora fallos individuales', async () => {
  const fs = fakeFs([], { removeFails: true });
  await assert.doesNotReject(deletePhotos(['file:///perm/a.jpg'], fs));
});

test('deletePhotos sigue con las demas si una falla', async () => {
  const fs = fakeFs([]);
  const orig = fs.remove;
  fs.remove = async (u) => { if (u.endsWith('a.jpg')) throw new Error('x'); return orig(u); };
  await deletePhotos(['file:///perm/a.jpg', 'file:///perm/b.jpg'], fs);
  assert.deepEqual(fs.removed, ['file:///perm/b.jpg']);
});

test('photoExists consulta al fs y no lanza', async () => {
  const fs = fakeFs(['file:///perm/a.jpg']);
  assert.equal(await photoExists('file:///perm/a.jpg', fs), true);
  assert.equal(await photoExists('file:///perm/z.jpg', fs), false);
  fs.exists = async () => { throw new Error('boom'); };
  assert.equal(await photoExists('file:///perm/a.jpg', fs), false);
});
