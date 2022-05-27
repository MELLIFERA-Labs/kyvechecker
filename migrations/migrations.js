const db = require('../src/db')
const { getAllPools } = require('../src/kyve-api')
const log = require('../src/logger').Logger('migration')

async function migrate() {
    const pools = await getAllPools()
    const poolUpdater = pools.map((it) => ({
        updateOne: {
            filter: { id: it.id },
            update: {
                $set: {
                    ...it,
                    min_stake_old: it.min_stake,
                    numberOfStakersOld: it.numberOfStakers,
                },
            },
            upsert: true,
        },
    }))
    await db.col.pools.bulkWrite(poolUpdater)
    log.info('pools update finished')

    const subscriptions = await db.col.nodes.find({}).toArray()
    const nodesUpdater = subscriptions.map((it) => ({
        updateOne: {
            filter: { account: it.account },
            update: { $set: { ...it, old_position: it.recent_position } },
        },
    }))
    await db.col.nodes.bulkWrite(nodesUpdater)
    log.info('nodes update finished')
    await db.client.close()
}
async function main() {
    await db.connect()
    await migrate()
}
main().catch((error) => {
    log.fatal(error)
    process.exit(1)
})
