import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore, StoreError, companyId } from "../server/store.mjs";

const project = { version: 1, projectNumber: "2701", projectName: "Raudikkokuja", scheduleName: "Yleisaikataulu", tasks: [{ id: 1, name: "Työvaihe" }], snapshots: [], milestones: [], extraDaysOff: [] };
const mika = { userId: "mika", userName: "Mika" };
const heikki = { userId: "heikki", userName: "Heikki" };

test("companies remain separate and edits require lock and matching revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "snedo-schedules-"));
  try {
    const store = createStore(directory);
    const created = await store.create("tjt", mika, project);
    assert.equal((await store.list("tjt")).length, 1);
    assert.equal((await store.list("previmek")).length, 0);
    await assert.rejects(() => store.get("previmek", created.id), (error) => error instanceof StoreError && error.status === 404);
    await assert.rejects(() => store.acquire("tjt", created.id, heikki), (error) => error instanceof StoreError && error.status === 423);
    await assert.rejects(() => store.update("tjt", created.id, mika, 0, project), (error) => error instanceof StoreError && error.status === 409);
    const saved = await store.update("tjt", created.id, mika, 1, { ...project, projectName: "Muokattu" });
    assert.equal(saved.revision, 2);
    assert.equal((await store.get("tjt", created.id)).data.projectName, "Muokattu");
    await store.release("tjt", created.id, mika);
    await store.acquire("tjt", created.id, heikki);
    await assert.rejects(() => store.update("tjt", created.id, mika, 2, project), (error) => error instanceof StoreError && error.status === 423);
    assert.equal((await store.update("tjt", created.id, heikki, 2, project)).revision, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("unknown company IDs are rejected", () => {
  assert.equal(companyId("tjt"), "tjt");
  assert.equal(companyId("previmek"), "previmek");
  assert.equal(companyId("../../other"), null);
});
