const {describe, it, beforeEach} = require("node:test");
const assert = require("node:assert/strict");
const {AuthService} = require("../auth");
const {Hasher} = require("../hashing");
const {makeDb} = require("./helpers");

describe("AuthService", () => {
    let db;
    let auth;

    beforeEach(() => {
        db = makeDb();
        auth = new AuthService(db);
    });

    it("signup stores a hashed password, not the plaintext", async () => {
        await auth.signup("alice", "pass123");
        const saved = db.createUser.mock.calls[0].arguments[0];
        assert.notEqual(saved.hash, "pass123");
        assert.equal(Hasher.Compare("pass123", saved.hash), true);
    });

    it("signup rejects a username that is already taken", async () => {
        await auth.signup("alice", "pass123");
        const result = await auth.signup("alice", "other");
        assert.equal(result.success, false);
        assert.equal(db.createUser.mock.callCount(), 1);
    });

    it("login succeeds with the correct password", async () => {
        await auth.signup("alice", "pass123");
        assert.equal((await auth.login("alice", "pass123")).success, true);
    });

    it("login fails with a wrong password or unknown user", async () => {
        await auth.signup("alice", "pass123");
        assert.equal((await auth.login("alice", "wrong")).success, false);
        assert.equal((await auth.login("bob", "pass123")).success, false);
    });
});