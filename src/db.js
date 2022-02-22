const { config } = require('./config-manager')
const { MongoClient } = require('mongodb')
const log = require('./logger').Logger('database')
// Connection URI
const uri = config.MONGO_DB
// Create a new MongoClient
const client = new MongoClient(uri)
async function connect() {
    // Connect the client to the server
    await client.connect()
    // Establish and verify connection
    await client.db('admin').command({ ping: 1 })
    log.info('Connected to database!')
}
//collections
const database = client.db()
const users = database.collection('users')
const subscriptions = database.collection('subscriptions')
const nodes = database.collection('nodes')
module.exports = {
    connect,
    col: {
        users,
        nodes,
        subscriptions,
    },
}
