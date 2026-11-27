const {Hasher} = require("./hashing")
const {DatabaseAdapter} = require("./database-adapter")

class AuthService{
    db;
    hasher;

    constructor(db=new DatabaseAdapter, hasher=new Hasher){
        
    }

    signup(username, password){
        
    }
    login(username, password){

    }
}