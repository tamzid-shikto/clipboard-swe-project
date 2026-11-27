const express = require('express');
const cookieParser = require('cookie-parser');
const { randomUUID } = require('crypto');
const path = require("path");
const { FsDatabase } = require("./fs-database");
const { AuthService } = require("./auth");
const { ClipboardService } = require("./clipboard");

const PORT = 3000;
const app = express();
const db = new FsDatabase();
const auth = new AuthService(db);
const clipboards = new ClipboardService(db);
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SESSIONS = {
    // [session_token]:[username]
}

function currentUser(req){
    return SESSIONS[req.cookies.session_token];
}
function unauthorized(res){
    res.status(401).json({success:false, error:"Unauthorized"});
}

app.post("/api/auth", async (req, res)=>{
    const mode = req.query.mode; //?mode=login    ?mode=signup
    const { username, password } = req.body;
    const result = mode === "signup" ? await auth.signup(username, password) : await auth.login(username, password);
    if(!result.success){
        return res.json(result);
    }
    const session_token = randomUUID();
    SESSIONS[session_token] = username;
    res.cookie("session_token", session_token, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000
    });
    res.json(result);
})
app.post("/api/logout", (req, res)=>{
    delete SESSIONS[req.cookies.session_token];
    res.clearCookie("session_token");
    res.json({success:true});
})
app.get("/api/list-clipboard", async (req, res)=>{
    const user = currentUser(req);
    if(!user){
        return unauthorized(res);
    }
    const result = await clipboards.list(user);
    res.json({...result, username:user});
})
app.post("/api/create-clipboard", async (req, res)=>{
    const user = currentUser(req);
    if(!user){
        return unauthorized(res);
    }
    res.json(await clipboards.create(user));
})
app.post("/api/delete-clipboard", async (req, res)=>{
    const user = currentUser(req);
    if(!user){
        return unauthorized(res);
    }
    res.json(await clipboards.remove(req.query.id, user));
})
app.get("/api/get-clipboard", (req, res)=>{
    const id = req.query.id; //?id=[CLIPBOARD_ID]
    const session_token = req.cookies.session_token;   
    //auth check
    //logic codes
    //if not owner, add visitor count
    //res.json({success, data}) 
})
app.post("/api/save-clipboard", (req, res)=>{
    const id = req.query.id; //?id=[CLIPBOARD_ID]
    const data = res.body;
    const session_token = req.cookies.session_token;   
    //auth check
    //logic codes
    //res.json({success}) 
})

app.listen(PORT, _=>{
    console.log("STARTED SERVER ON PORT: ", PORT)
})