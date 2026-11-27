const fs = require("fs");
const path = require("path");
const {DatabaseAdapter} = require("./database-adapter");

const db_file_name = "database.json";
const db_path = path.join(__dirname, db_file_name);

let DB = {};

async function Init(){
    if(!fs.existsSync(db_path)){
        fs.writeFileSync(db_path, "{}");
    }
    DB = JSON.parse(fs.readFileSync(db_path).toString());
}

async function SaveDBState(){
    fs.writeFileSync(db_path, JSON.stringify(DB));
}

async function Get(bucket_name, key, default_value){
    return DB[bucket_name]?.[key] ?? default_value;
}
async function Save(bucket_name, key, value){
    DB[bucket_name] ??= {};
    DB[bucket_name][key] = value;
    await SaveDBState();
}
async function Delete(bucket_name, key){
    if(DB[bucket_name]){
        delete DB[bucket_name][key];
    }
    await SaveDBState();
}
async function List(bucket_name){
    return Object.values(DB[bucket_name] ?? {});
}

class FsDatabase extends DatabaseAdapter{
    constructor(){
        super();
        this.ready = Init();
    }

    async getUser(username){
        await this.ready;
        return Get("users", username, null);
    }
    async createUser(user){
        await this.ready;
        await Save("users", user.username, user);
    }
    async getClipboard(id){
        await this.ready;
        return Get("clipboards", id, null);
    }
    async listClipboards(owner){
        await this.ready;
        const all = await List("clipboards");
        return all.filter(c => c.owner === owner);
    }
    async saveClipboard(clipboard){
        await this.ready;
        await Save("clipboards", clipboard.id, clipboard);
    }
    async deleteClipboard(id){
        await this.ready;
        await Delete("clipboards", id);
    }
}

exports.Init = Init;
exports.Get = Get;
exports.Save = Save;
exports.Delete = Delete;
exports.List = List;
exports.FsDatabase = FsDatabase;