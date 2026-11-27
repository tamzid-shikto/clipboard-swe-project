const {describe, it, beforeEach} = require("node:test");
const assert = require("node:assert/strict");
const {ClipboardService, Visibility} = require("../clipboard");
const {makeDb} = require("./helpers");

describe("ClipboardService", () => {
    let db;
    let service;
    let c;

    beforeEach(async () => {
        db = makeDb();
        service = new ClipboardService(db);
        const created = await service.create("alice");
        c = db.clipboards[created.data.id];
    });

    describe("owner-only actions", () => {
        it("getForEdit refuses another user", async () => {
            assert.equal((await service.getForEdit(c.id, "bob")).success, false);
        });

        it("update refuses another user and does not save", async () => {
            const saves = db.saveClipboard.mock.callCount();
            const result = await service.update(c.id, "bob", {title: "x"});
            assert.equal(result.success, false);
            assert.equal(c.title, "Untitled");
            assert.equal(db.saveClipboard.mock.callCount(), saves);
        });

        it("remove refuses another user and does not delete", async () => {
            const result = await service.remove(c.id, "bob");
            assert.equal(result.success, false);
            assert.equal(db.deleteClipboard.mock.callCount(), 0);
        });

        it("update cannot change owner, id or views", async () => {
            await service.update(c.id, "alice", {owner: "bob", id: "hacked", views: 99});
            assert.equal(c.owner, "alice");
            assert.notEqual(c.id, "hacked");
            assert.equal(c.views, 0);
        });
    });

    describe("view", () => {
        it("counts views from others but not from the owner", async () => {
            await service.view(c.id, "alice");
            assert.equal(c.views, 0);
            await service.view(c.id, "bob");
            assert.equal(c.views, 1);
        });

        it("hides a private clipboard from others", async () => {
            c.visibility = Visibility.PRIVATE;
            assert.equal((await service.view(c.id, "bob")).success, false);
            assert.equal((await service.view(c.id, "alice")).success, true);
        });

        it("hides an expired clipboard from others", async () => {
            c.expiresAt = Date.now() - 1000;
            assert.equal((await service.view(c.id, "bob")).success, false);
            assert.equal((await service.view(c.id, "alice")).success, true);
        });

        it("protects a clipboard with a password and never leaks the hash", async () => {
            await service.update(c.id, "alice", {visibility: Visibility.PASSWORD, password: "pw"});
            assert.equal((await service.view(c.id, "bob")).success, false);
            assert.equal((await service.view(c.id, "bob", "nope")).success, false);
            const result = await service.view(c.id, "bob", "pw");
            assert.equal(result.success, true);
            assert.equal("passwordHash" in result.data, false);
        });
    });
});