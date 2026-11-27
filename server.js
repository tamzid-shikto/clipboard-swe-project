const express = require('express');
const cookieParser = require('cookie-parser');
const { randomUUID } = require('crypto');
const path = require("path");
const { FsDatabase } = require("./fs-database");
const { AuthService } = require("./auth");

const PORT = 3000;
const app = express();
const auth = new AuthService(new FsDatabase());
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SESSIONS = {
    // [session_token]:[username]
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
app.get("/api/list-clipboard", (req, res)=>{
    const session_token = req.cookies.session_token;   
    //auth check
    //logic codes
    //res.json({success, data}) 
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
