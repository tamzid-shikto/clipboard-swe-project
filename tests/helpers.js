const {mock} = require("node:test");

function makeDb(){
    const users = {};
    const clipboards = {};
    return {
        users,
        clipboards,
        getUser: mock.fn(async username => users[username] ?? null),
        createUser: mock.fn(async user => { users[user.username] = user; }),
        getClipboard: mock.fn(async id => clipboards[id] ?? null),
        listClipboards: mock.fn(async owner => Object.values(clipboards).filter(c => c.owner === owner)),
        saveClipboard: mock.fn(async clipboard => { clipboards[clipboard.id] = clipboard; }),
        deleteClipboard: mock.fn(async id => { delete clipboards[id]; })
    };
}

exports.makeDb = makeDb;