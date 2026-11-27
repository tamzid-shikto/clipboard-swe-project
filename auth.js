const {Hasher} = require("./hashing")
const {DatabaseAdapter} = require("./database-adapter")
const {User} = require("./user")

class AuthService{
    db;
    hasher;

    constructor(db=new DatabaseAdapter, hasher=new Hasher){
        this.db = db;
        this.hasher = hasher;
    }

    async signup(username, password){
        if(!username || !password){
            return {success:false, error:"Username and password required"};
        }
        if(await this.db.getUser(username)){
            return {success:false, error:"Username already taken"};
        }
        const user = new User();
        user.username = username;
        user.hash = Hasher.Hash(password);
        await this.db.createUser(user);
        return {success:true};
    }
    async login(username, password){
        const user = await this.db.getUser(username);
        if(!user || !Hasher.Compare(password, user.hash)){
            return {success:false, error:"Invalid username or password"};
        }
        return {success:true};
    }
}

exports.AuthService = AuthService;