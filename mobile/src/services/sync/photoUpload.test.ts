import { test } from "node:test";
import assert from "node:assert/strict";
import { storagePath } from "./photoUpload";
test("storagePath: {userId}/{ownerId}/{i}.jpg", () => {
  assert.equal(storagePath("u1","v1",0),"u1/v1/0.jpg"); assert.equal(storagePath("u1","v1",2),"u1/v1/2.jpg");
});
