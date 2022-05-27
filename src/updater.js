const { getAllValidator, getAllPools } = require('./kyve-api')
const db = require('./db')
const log = require('./logger').Logger('updater')
const { config } = require('./config-manager')

async function updater() {
    const localNodes = await db.col.nodes.find({}).toArray()
    const remoteNodes = (await getAllValidator()).reduce((acc, node) => {
        acc[node.account] = node
        return acc
    }, {})

    const updatingNodes = localNodes.map((localNode) => {
        const localNodeInActiveSet = remoteNodes[localNode.account]
        if (!localNodeInActiveSet)
            return {
                filter: { account: localNode.account },
                update: { $set: { recent_position: null } },
            }
        return {
            filter: { account: localNode.account },
            update: { $set: { ...localNodeInActiveSet } },
        }
    })
    if (updatingNodes.length) {
        const nodesUpdateResult = await db.col.nodes.bulkWrite(
            updatingNodes.map((it) => ({ updateOne: { ...it } }))
        )
        log.info('nodes update finished', nodesUpdateResult)
    }
    const pools = await getAllPools()
    const poolUpdater = pools.map((it) => ({
        updateOne: {
            filter: { id: it.id },
            update: { $set: { ...it } },
            upsert: true,
        },
    }))
    const poolsUpdateResult = await db.col.pools.bulkWrite(poolUpdater)
    log.info('pools update finished', poolsUpdateResult)
}
async function loop() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        await updater()
        await new Promise((resolve) =>
            setTimeout(resolve, config.NOTIFIER_SLEEP)
        )
    }
}

async function main() {
    await db.connect()
    await loop()
}
main().catch((error) => {
    log.fatal(error)
    process.exit(1)
})
