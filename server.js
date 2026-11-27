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

// Returns the logged-in username, or null for anonymous visitors.
function currentUser(req){
    const token = req.cookies.session_token;
    return Object.hasOwn(SESSIONS, token) ? SESSIONS[token] : null;
}

// Password for protected clipboards is sent in a header (URI-encoded by the page),
// so it never appears in URLs or server logs.
function readPassword(req){
    const raw = req.get("x-clipboard-password");
    if(!raw) return "";
    try{ return decodeURIComponent(raw); }catch{ return ""; }
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
app.get("/api/get-clipboard", async (req, res)=>{
    const id = req.query.id; //?id=[CLIPBOARD_ID]
    if(typeof id !== "string" || !id){
        return res.status(400).json({success:false, error:"Clipboard id required"});
    }
    const viewer = currentUser(req); // null = anonymous, allowed for public clipboards
    const result = await clipboards.view(id, viewer, readPassword(req));
    if(!result.success){
        const status = result.error === "Wrong password" ? 401 : 404;
        return res.status(status).json(result);
    }
    // view() already counts the visit when the viewer is not the owner
    res.json({...result, isOwner: viewer !== null && result.data.owner === viewer});
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