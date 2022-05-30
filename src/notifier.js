const db = require('./db')
const bot = require('./bot')
const log = require('./logger').Logger('notifier')
const { config } = require('./config-manager')
const { BigNumber } = require('bignumber.js')

function toInfOrNumber(number) {
    if (!number) return Infinity
    return number
}
async function messageSender(messages) {
    await Promise.allSettled(messages).then((result) => {
        const rejects = result.filter((it) => it.status === 'rejected')
        if (rejects.length) {
            log.error(
                'Error to notify:',
                rejects.map((it) => it.reason)
            )
        }
    })
}
async function notifier() {
    log.info('start notify')
    const filterNode = [{ $match: { operationType: { $in: ['update'] } } }]
    const filterPool = [
        { $match: { operationType: { $in: ['update', 'insert'] } } },
    ]
    const nodesWatcher = db.col.nodes.watch(filterNode)
    nodesWatcher.on('change', async (next) => {
        if (
            next?.updateDescription?.updatedFields?.recent_position ===
            undefined
        )
            return
        const node = await db.col.nodes.findOne({ _id: next.documentKey._id })
        const currentPosition = toInfOrNumber(node.recent_position)
        const prevPosition = toInfOrNumber(node.old_position)
        await db.col.nodes.updateOne(
            { _id: next.documentKey._id },
            { $set: { old_position: currentPosition } }
        )
        if (currentPosition === prevPosition) return
        const nodesSubs = await db.col.nodeSubscriptions
            .find({ node_address: node.account })
            .toArray()
        if (!nodesSubs.length) return
        const messages = []

        for (let nodeSub of nodesSubs) {
            //fail notification
            if (
                nodeSub.isNotify &&
                prevPosition <= nodeSub.threshold &&
                currentPosition > nodeSub.threshold
            ) {
                messages.push(
                    bot.api.sendMessage(
                        nodeSub.user,
                        `🔴 SANK DOWN\nNode: ${nodeSub.node_address} \nPool:${nodeSub.meta.name} \nPool id: ${nodeSub.pool_id}\nname: ${node.moniker}`
                    )
                )
                log.debug('send failed notification', {
                    user: nodeSub.user,
                    node_address: nodeSub.node_address,
                })
            }
            //success notification
            if (
                nodeSub.isNotify &&
                prevPosition > nodeSub.threshold &&
                currentPosition <= nodeSub.threshold
            ) {
                messages.push(
                    bot.api.sendMessage(
                        nodeSub.user,
                        `✅ UP\nNode: ${nodeSub.node_address} \nPool:${nodeSub.meta.name} \nPool id: ${nodeSub.pool_id}\nname: ${node.moniker}`
                    )
                )
                log.debug('send success notification', {
                    user: nodeSub.user,
                    node_address: nodeSub.node_address,
                })
            }
        }
        await messageSender(messages)
    })
    const poolWatcher = db.col.pools.watch(filterPool)
    poolWatcher.on('change', async (next) => {
        if (next.operationType === 'insert') {
            const users = await db.col.users.find({ is_active: true }).toArray()
            await Promise.allSettled(
                users.map((user) =>
                    bot.api.sendMessage(
                        user.id,
                        `New Pool is launch  🎉🎉🎉! \n ${next.fullDocument.name} `
                    )
                )
            )
            await db.col.pools.updateOne(
                { _id: next.documentKey._id },
                {
                    $set: {
                        numberOfStakersOld: next.fullDocument.numberOfStakers,
                        min_stake_old: next.fullDocument.min_stake,
                    },
                }
            )
        }
        if (
            next?.updateDescription?.updatedFields?.numberOfStakers ||
            next?.updateDescription?.updatedFields?.min_stake
        ) {
            const pool = await db.col.pools.findOne({
                _id: next.documentKey._id,
            })
            const poolSubs = await db.col.poolSubscriptions
                .find({ pool_id: pool.id })
                .toArray()
            if (!poolSubs.length) return
            if (next?.updateDescription?.updatedFields?.numberOfStakers) {
                const numberOfStakers =
                    next.updateDescription.updatedFields.numberOfStakers
                const prevNumberOfStakers =
                    pool.numberOfStakersOld || config.DEFAULT_THRESHOLD
                await db.col.pools.updateOne(
                    { _id: next.documentKey._id },
                    { $set: { numberOfStakersOld: numberOfStakers } }
                )
                if (numberOfStakers === prevNumberOfStakers) return
                const messages = []
                for (let poolSub of poolSubs) {
                    if (
                        poolSub.isNotifyAboutFreePlace &&
                        prevNumberOfStakers === config.DEFAULT_THRESHOLD &&
                        numberOfStakers < config.DEFAULT_THRESHOLD
                    ) {
                        messages.push(
                            bot.api.sendMessage(
                                poolSub.user,
                                `🆓 Free place in pool: ${pool.name} \n number of validators: ${pool.numberOfStakers}`
                            )
                        )
                    }
                }

                await messageSender(messages)
                log.info(
                    `Notifying free place pool:${pool.name} finished:`,
                    messages.length
                )
            }
            if (next?.updateDescription?.updatedFields?.min_stake) {
                const currentStake =
                    next.updateDescription.updatedFields.min_stake
                const oldStake = pool.min_stake_old || currentStake
                await db.col.pools.updateOne(
                    { _id: next.documentKey._id },
                    { $set: { min_stake_old: currentStake } }
                )
                if (currentStake === oldStake) return
                const messages = []
                for (let poolSub of poolSubs) {
                    if (
                        poolSub.isNotifyWithMinimalStake &&
                        poolSub.minStakeThreshold &&
                        new BigNumber(oldStake).isGreaterThanOrEqualTo(
                            new BigNumber(poolSub.minStakeThreshold)
                        ) &&
                        new BigNumber(currentStake).isLessThanOrEqualTo(
                            poolSub.minStakeThreshold
                        )
                    ) {
                        messages.push(
                            bot.api.sendMessage(
                                poolSub.user,
                                `💰 Min stake notification: ${pool.name} \n min stake: ${pool.min_stake}`
                            )
                        )
                    }
                }

                await messageSender(messages)
                log.info(
                    `Notifying pool min stake:${pool.name} finished:`,
                    messages.length
                )
            }
        }
    })
}

async function main() {
    await db.connect()
    await notifier()
}
main().catch((error) => {
    log.fatal(error)
    process.exit(1)
})
