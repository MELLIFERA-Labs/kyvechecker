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
const nodeSubscriptions = database.collection('subscriptions')
const poolSubscriptions = database.collection('pool_subscriptions')
const pools = database.collection('pools')
const poolsOld = database.collection('pools_old')
const nodes = database.collection('nodes')
const nodesOld = database.collection('nodes_old')
module.exports = {
    client,
    connect,
    col: {
        users,
        nodes,
        nodeSubscriptions,
        poolSubscriptions,
        pools,
        poolsOld,
        nodesOld,
    },
}
