const { getAllValidator } = require('./kyve-api')
const db = require('./db')
const bot = require('./bot')
const log = require('./logger').Logger('notifier')
const { config } = require('./config-manager')

function toInfOrNumber(number) {
    if (!number) return Infinity
    return number
}
async function notifier() {
    log.info('start notify')
    const subscriptions = await db.col.subscriptions.find({}).toArray()
    //todo make it more efficient
    const localNodes = await db.col.nodes.find().toArray()
    const remoteNodes = (await getAllValidator()).reduce((acc, node) => {
        acc[node.nodeAddress] = node
        return acc
    }, {})
    for (let node of localNodes) {
        const remNode = remoteNodes[node.nodeAddress]
        const prevPosition = toInfOrNumber(node.recent_position)
        const currentPosition = toInfOrNumber(remNode?.recent_position ?? null)
        const nodeSubs = subscriptions.filter(
            (sub) => sub.node_address === node.nodeAddress
        )
        if (!remNode) {
            await db.col.nodes.updateOne(
                { nodeAddress: node.nodeAddress },
                { $set: { recent_position: null } }
            )
        } else {
            await db.col.nodes.updateOne(
                { nodeAddress: node.nodeAddress },
                { $set: { ...remNode } }
            )
        }
        const messages = []
        for (let nodeSub of nodeSubs) {
            //fail notification
            if (
                nodeSub.isNotify &&
                prevPosition <= nodeSub.threshold &&
                currentPosition > nodeSub.threshold
            ) {
                messages.push(
                    bot.api.sendMessage(
                        nodeSub.user,
                        `🔴 SANK DOWN\nNode: ${nodeSub.node_address} \nPool:${nodeSub.meta.name} \nPool id: ${nodeSub.pool_id}`
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
                        `✅ UP\nNode: ${nodeSub.node_address} \nPool:${nodeSub.meta.name} \nPool id: ${nodeSub.pool_id}\n`
                    )
                )
                log.debug('send success notification', {
                    user: nodeSub.user,
                    node_address: nodeSub.node_address,
                })
            }
        }
        await Promise.allSettled(messages).then((result) => {
            const rejects = result.filter((it) => it.status === 'rejected')
            if (rejects.length) {
                log.error(
                    'Error to notify:',
                    rejects.map((it) => it.reason)
                )
            }
        })
        log.info(
            `Notifying node:${node.pool.metadata.runtime}|${node.nodeAddress} finished:`,
            messages.length
        )
    }
}
async function loop() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        await notifier()
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
