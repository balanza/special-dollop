module.exports = {
    storage: {
        path: process.env.STORAGE_PATH || './database.sqlite3'
    },
    server:{
        port:  process.env.PORT || 3001
    }
}