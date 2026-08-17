import { test } from "node:test";
import assert from "node:assert/strict";
import { toSessionPayload, toVisitPayload, toPingPayload, toAnomalyProductPayload } from "./payloads";
test("toSessionPayload: start_location como {lat,lng}", () => {
  const p = toSessionPayload({ session_id:"s1", user_id:"u1", route_id:"r1", session_start:"t0", session_end:null, start_lat:10.5, start_lng:-66.9, synced:0 });
  assert.deepEqual(p.start_location, { lat:10.5, lng:-66.9 }); assert.equal(p.route_id,"r1"); assert.equal(p.session_end,null);
});
test("toVisitPayload: check_in_location y photo_urls", () => {
  const p = toVisitPayload({ visit_id:"v1", session_id:"s1", store_id:"st1", user_id:"u1", check_in_time:"t", lat:1, lng:2, photo_uri:'["file://a"]', observations:"obs", status:"completed", anomaly_type:null, skip_reason:null, last_restock_date:null, synced:0 }, ["u1/v1/0.jpg"]);
  assert.deepEqual(p.check_in_location,{lat:1,lng:2}); assert.deepEqual(p.photo_urls,["u1/v1/0.jpg"]); assert.equal(p.status,"completed");
});
test("toVisitPayload: check_in_location null si faltan coords", () => {
  const p = toVisitPayload({ visit_id:"v2", session_id:"s1", store_id:"st1", user_id:"u1", check_in_time:"t", lat:null, lng:null, photo_uri:null, observations:null, status:"skipped", anomaly_type:null, skip_reason:"sin_acceso", last_restock_date:null, synced:0 }, []);
  assert.equal(p.check_in_location, null);
});
test("toPingPayload: shape mínimo", () => {
  const p = toPingPayload({ ping_id:"p1", session_id:"s1", user_id:"u1", timestamp:"t", lat:1, lng:2 });
  assert.equal(p.ping_id,"p1"); assert.equal(p.user_id,"u1");
});
test("toVisitPayload: anomaly_type JSON se parsea a array", () => {
  const p = toVisitPayload({ visit_id:"v3", session_id:"s1", store_id:"st1", user_id:"u1", check_in_time:"t", lat:1, lng:2, photo_uri:null, observations:null, status:"anomaly", anomaly_type:'["sin_stock","producto_danado"]', skip_reason:null, last_restock_date:null, synced:0 }, []);
  assert.deepEqual(p.anomaly_type, ["sin_stock", "producto_danado"]);
});
test("toVisitPayload: anomaly_type null queda null", () => {
  const p = toVisitPayload({ visit_id:"v4", session_id:"s1", store_id:"st1", user_id:"u1", check_in_time:"t", lat:1, lng:2, photo_uri:null, observations:null, status:"completed", anomaly_type:null, skip_reason:null, last_restock_date:null, synced:0 }, []);
  assert.equal(p.anomaly_type, null);
});

test('toAnomalyProductPayload manda las tres claves y nada mas', () => {
  const out = toAnomalyProductPayload({
    visit_id: 'v1', anomaly_type: 'sin_stock', product_id: 'p1', synced: 0,
  });
  assert.deepEqual(out, { visit_id: 'v1', anomaly_type: 'sin_stock', product_id: 'p1' });
});

test('toVisitPayload incluye el supervisor presente cuando lo hay', () => {
  const row: any = {
    visit_id: 'v1', session_id: 's1', store_id: 'st1', user_id: 'u1',
    check_in_time: '2026-08-17T12:00:00.000Z', lat: 10, lng: -66,
    observations: null, status: 'completed', anomaly_type: null, skip_reason: null,
    last_restock_date: null, supervisor_present_user_id: 'sup1',
  };
  assert.equal(toVisitPayload(row, []).supervisor_present_user_id, 'sup1');
});

test('toVisitPayload manda null cuando no hubo acompanante', () => {
  const row: any = {
    visit_id: 'v2', session_id: 's1', store_id: 'st1', user_id: 'u1',
    check_in_time: '2026-08-17T12:00:00.000Z', lat: null, lng: null,
    observations: null, status: 'completed', anomaly_type: null, skip_reason: null,
    last_restock_date: null,
  };
  assert.equal(toVisitPayload(row, []).supervisor_present_user_id, null);
});
