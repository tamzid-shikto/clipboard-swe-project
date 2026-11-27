const {randomBytes} = require("crypto");
const {Hasher} = require("./hashing");
const {DatabaseAdapter} = require("./database-adapter");

const Visibility = {PRIVATE: 0, PUBLIC: 1, PASSWORD: 2};

function strip(clipboard){
    const {passwordHash, ...rest} = clipboard;
    return rest;
}

class ClipboardService{
    db;
    hasher;

    constructor(db=new DatabaseAdapter, hasher=new Hasher){
        this.db = db;
        this.hasher = hasher;
    }

    async newID(){
        let id;
        do{
            id = randomBytes(4).toString("hex");
        }while(await this.db.getClipboard(id));
        return id;
    }
    async create(owner){
        const clipboard = new Clipboard();
        clipboard.id = await this.newID();
        clipboard.owner = owner;
        await this.db.saveClipboard(clipboard);
        return {success:true, data:strip(clipboard)};
    }
    async list(owner){
        const clipboards = await this.db.listClipboards(owner);
        return {success:true, data:clipboards.map(strip)};
    }
    async getForEdit(id, user){
        const clipboard = await this.db.getClipboard(id);
        if(!clipboard || clipboard.owner !== user){
            return {success:false, error:"Not found"};
        }
        return {success:true, data:strip(clipboard)};
    }
    async update(id, user, body){
        const clipboard = await this.db.getClipboard(id);
        if(!clipboard || clipboard.owner !== user){
            return {success:false, error:"Not found"};
        }
        for(const key of ["title", "text", "visibility", "expiresAt"]){
            if(body[key] !== undefined){
                clipboard[key] = body[key];
            }
        }
        if(body.password){
            clipboard.passwordHash = Hasher.Hash(body.password);
        }
        await this.db.saveClipboard(clipboard);
        return {success:true};
    }
    async remove(id, user){
        const clipboard = await this.db.getClipboard(id);
        if(!clipboard || clipboard.owner !== user){
            return {success:false, error:"Not found"};
        }
        await this.db.deleteClipboard(id);
        return {success:true};
    }
    async view(id, viewer, password){
        const clipboard = await this.db.getClipboard(id);
        if(!clipboard){
            return {success:false, error:"Not found"};
        }
        if(clipboard.owner === viewer){
            return {success:true, data:strip(clipboard)};
        }
        if(clipboard.expiresAt && Date.now() > clipboard.expiresAt){
            return {success:false, error:"Not found"};
        }
        if(clipboard.visibility === Visibility.PRIVATE){
            return {success:false, error:"Not found"};
        }
        if(clipboard.visibility === Visibility.PASSWORD){
            if(!clipboard.passwordHash || !Hasher.Compare(password, clipboard.passwordHash)){
                return {success:false, error:"Wrong password"};
            }
        }
        clipboard.views++;
        await this.db.saveClipboard(clipboard);
        return {success:true, data:strip(clipboard)};
    }
}

class Clipboard {
    id="";
    owner="";
    title="Untitled"; 
    text="";
    visibility=1;
    expiresAt=0;
    views=0;
    passwordHash="";
}

exports.ClipboardService = ClipboardService;
exports.Clipboard = Clipboard;
exports.Visibility = Visibility;