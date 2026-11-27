const {Hasher} = require("./hashing")
const {DatabaseAdapter} = require("./database-adapter")

class ClipboardService{
    db;
    hasher;

    constructor(db=new DatabaseAdapter, hasher=new Hasher){
        
    }

    newID(){
        
    }
    create(owner){

    }
    list(owner){

    }
    getForEdit(id, user){

    }
    update(id, user, body){

    }
    remove(id, user){

    }
    view(id, viewer, password){

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
}

exports.ClipboardService = ClipboardService;
exports.Clipboard = Clipboard;