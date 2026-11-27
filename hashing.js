const crypto = require("crypto");

class Hasher{
    static Hash(plaintext) {
        const salt = crypto.randomBytes(16).toString("hex");
        const key = crypto.scryptSync(String(plaintext ?? ""), salt, 64).toString("hex");
        return salt + ":" + key;
    }
    static Compare(plaintext, hash){
        const [salt, key] = hash.split(":");
        const test = crypto.scryptSync(String(plaintext ?? ""), salt, 64);
        return crypto.timingSafeEqual(test, Buffer.from(key, "hex"));
    }
}

exports.Hasher = Hasher;