import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { shortError, storagePath, uploadPhotos } from "./photoUpload";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const yes = async () => true;
const no = async () => false;

function supa(o: { failPaths?: string[]; existing?: string[]; listFails?: boolean; listThrows?: boolean; fileBytes?: number; emptyOnServer?: string[]; infoError?: unknown } = {}) {
  globalThis.fetch = (async () => ({ arrayBuffer: async () => new ArrayBuffer(o.fileBytes ?? 1) })) as any;
  const uploads: string[] = [];
  const infos: string[] = [];
  return {
    uploads,
    infos,
    storage: {
      from: () => ({
        list: async () => { throw new Error("list no se usa: en producción agota el tiempo"); },
        info: async (path: string) => {
          infos.push(path);
          if (o.listThrows) throw new Error("Network request failed");
          if (o.infoError) return { data: null, error: o.infoError };
          if (o.listFails) return { data: null, error: { message: "consulta caída", status: 500 } };
          const name = path.split("/").pop()!;
          if (o.emptyOnServer?.includes(name)) return { data: { size: 0 }, error: null };
          return o.existing?.includes(name)
            ? { data: { size: 1 }, error: null }
            : { data: null, error: { message: "Object not found", status: 400, statusCode: "404" } };
        },
        upload: async (path: string) => {
          if (o.failPaths?.includes(path)) return { error: { message: "foto no subió" } };
          uploads.push(path);
          return { error: null };
        },
      }),
    },
  } as any;
}

test("storagePath: {userId}/{ownerId}/{i}.jpg", () => {
  assert.equal(storagePath("u1","v1",0),"u1/v1/0.jpg"); assert.equal(storagePath("u1","v1",2),"u1/v1/2.jpg");
});

test("sigue con las demás si una falla y conserva el índice", async () => {
  const r = await uploadPhotos(supa({ failPaths: ["u/v/1.jpg"] }), "u", "v", ["a", "b", "c"], { exists: yes });
  assert.deepEqual(r.paths, ["u/v/0.jpg", "u/v/2.jpg"]);
  assert.equal(r.failed[0].index, 1);
  assert.deepEqual(r.missing, []);
});

test("archivo ausente con listado correcto: missing", async () => {
  const r = await uploadPhotos(supa(), "u", "v", ["a"], { exists: no });
  assert.deepEqual(r.missing, [0]);
  assert.deepEqual(r.failed, []);
});

test("archivo ausente pero ya está en Storage: cuenta como subida", async () => {
  const r = await uploadPhotos(supa({ existing: ["0.jpg"] }), "u", "v", ["a"], { exists: no });
  assert.deepEqual(r.paths, ["u/v/0.jpg"]);
  assert.deepEqual(r.missing, []);
});

test("archivo ausente sin poder listar Storage: failed, nunca missing", async () => {
  const r = await uploadPhotos(supa({ listFails: true }), "u", "v", ["a"], { exists: no });
  assert.deepEqual(r.missing, []);
  assert.equal(r.failed.length, 1);
  assert.equal(r.listed, false);
});

test("listed es true cuando todas subieron", async () => {
  const r = await uploadPhotos(supa(), "u", "v", ["a"], { exists: yes });
  assert.equal(r.listed, true);
});

test("primer intento con archivos presentes: sube directo, sin consultar Storage", async () => {
  const s = supa();
  const r = await uploadPhotos(s, "u", "v", ["a", "b"], { exists: yes, attempts: 0 });
  assert.deepEqual(r.paths, ["u/v/0.jpg", "u/v/1.jpg"]);
  assert.deepEqual(s.infos, []);
});

test("reintento: la foto ya arriba no se vuelve a subir", async () => {
  const s = supa({ existing: ["0.jpg"] });
  const r = await uploadPhotos(s, "u", "v", ["a", "b"], { exists: yes, attempts: 1 });
  assert.deepEqual(r.paths, ["u/v/0.jpg", "u/v/1.jpg"]);
  assert.deepEqual(s.uploads, ["u/v/1.jpg"]);
});

test("reintento: un objeto vacío en Storage se vuelve a subir", async () => {
  const s = supa({ emptyOnServer: ["0.jpg"] });
  const r = await uploadPhotos(s, "u", "v", ["a"], { exists: yes, attempts: 1 });
  assert.deepEqual(s.uploads, ["u/v/0.jpg"]);
  assert.deepEqual(r.failed, []);
});

test("archivo ausente con token vencido (404 Bucket not found): failed, nunca missing", async () => {
  const r = await uploadPhotos(
    supa({ infoError: { message: "Bucket not found", status: 400, statusCode: "404" } }),
    "u", "v", ["a"], { exists: no },
  );
  assert.deepEqual(r.missing, []);
  assert.equal(r.failed.length, 1);
  assert.equal(r.listed, false);
});

test("subida fallida que Storage confirma ausente: se puede enlazar lo demás", async () => {
  const r = await uploadPhotos(supa({ failPaths: ["u/v/0.jpg"] }), "u", "v", ["a", "b"], { exists: yes });
  assert.deepEqual(r.paths, ["u/v/1.jpg"]);
  assert.equal(r.listed, true);
});

test("subida fallida sin poder confirmar: no se enlaza", async () => {
  const r = await uploadPhotos(supa({ failPaths: ["u/v/0.jpg"], listFails: true }), "u", "v", ["a", "b"], { exists: yes });
  assert.deepEqual(r.paths, ["u/v/1.jpg"]);
  assert.equal(r.listed, false);
});

test("archivo ausente con listado que lanza: failed, nunca missing", async () => {
  const r = await uploadPhotos(supa({ listThrows: true }), "u", "v", ["a"], { exists: no });
  assert.deepEqual(r.missing, []);
  assert.equal(r.failed.length, 1);
  assert.equal(r.listed, false);
});

test("archivo de cero bytes: failed, no se sube", async () => {
  const s = supa({ fileBytes: 0 });
  const r = await uploadPhotos(s, "u", "v", ["a"], { exists: yes });
  assert.equal(r.failed.length, 1);
  assert.equal(s.uploads.length, 0);
});

test("archivo vacío con 0 intentos: failed, la lectura pudo ser pasajera", async () => {
  const r = await uploadPhotos(supa({ fileBytes: 0 }), "u", "v", ["a"], { exists: yes, attempts: 0 });
  assert.equal(r.failed.length, 1);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.empty, []);
});

test("archivo vacío con 2 intentos: sigue en failed", async () => {
  const r = await uploadPhotos(supa({ fileBytes: 0 }), "u", "v", ["a"], { exists: yes, attempts: 2 });
  assert.equal(r.failed.length, 1);
  assert.deepEqual(r.missing, []);
});

test("archivo vacío con 3 intentos, listado correcto y tamaño real 0: missing y marcado vacío", async () => {
  const s = supa({ fileBytes: 0 });
  const r = await uploadPhotos(s, "u", "v", ["a"], { exists: yes, attempts: 3, size: async () => 0 });
  assert.deepEqual(r.missing, [0]);
  assert.deepEqual(r.empty, [0]);
  assert.deepEqual(r.failed, []);
  assert.equal(s.uploads.length, 0);
});

test("lectura vacía de un archivo con bytes: sigue en failed aunque agote los intentos", async () => {
  const r = await uploadPhotos(supa({ fileBytes: 0 }), "u", "v", ["a"], { exists: yes, attempts: 3, size: async () => 2048 });
  assert.equal(r.failed.length, 1);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.empty, []);
});

test("lectura vacía y tamaño que no se puede leer: sigue en failed", async () => {
  const r = await uploadPhotos(supa({ fileBytes: 0 }), "u", "v", ["a"], {
    exists: yes, attempts: 3, size: async () => { throw new Error("sin acceso"); },
  });
  assert.equal(r.failed[0].error, "sin acceso");
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.empty, []);
});

test("archivo vacío con 3 intentos y listado caído: failed, nunca missing", async () => {
  const r = await uploadPhotos(supa({ fileBytes: 0, listFails: true }), "u", "v", ["a"], { exists: yes, attempts: 3 });
  assert.equal(r.failed.length, 1);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.empty, []);
});

test("una lectura local que falla no lanza: queda en failed", async () => {
  const s = supa();
  globalThis.fetch = (async () => { throw new Error("no se pudo leer"); }) as any;
  const r = await uploadPhotos(s, "u", "v", ["a"], { exists: yes });
  assert.deepEqual(r.paths, []);
  assert.equal(r.failed[0].error, "no se pudo leer");
});

test("onPhotoDone se llama por cada foto subida o ya arriba", async () => {
  let done = 0;
  await uploadPhotos(supa({ existing: ["0.jpg"], failPaths: ["u/v/2.jpg"] }), "u", "v", ["a", "b", "c"], {
    exists: yes, onPhotoDone: () => { done++; },
  });
  assert.equal(done, 2);
});

test("shortError: sin URLs firmadas ni tokens y con tope de largo", () => {
  const msg = shortError(new Error("fallo https://x.supabase.co/storage/v1/object/sign/a.jpg?token=abc y eyJhbGci.a.b"));
  assert.ok(!msg.includes("token=") && !msg.includes("eyJ"));
  assert.ok(msg.startsWith("fallo"));
  assert.ok(shortError(new Error("x".repeat(500))).length <= 200);
  assert.equal(shortError({ message: "del servidor", code: "42501" }), "del servidor");
});
