const db = require('./db')
const config = require('./../config')
const kyveAPI = require('./kyve-api')
const bot = require('./bot')
const { ObjectId } = require('mongodb')
const { toHumanReadable } = require('./utils')
const { createSubNodeBtns } = require('./keyboard/subscriptions-node.inline')
const { createSubPoolBtns } = require('./keyboard/subscriptions-pool.inline')
const { register } = require('./utils')
const { hydrate } = require('@grammyjs/hydrate')
const log = require('./logger').Logger('bot')
const { StatelessQuestion } = require('@grammyjs/stateless-question')
const { getValidatorsByPoolId } = require('./kyve-api')
const { BigNumber } = require('bignumber.js')

bot.use(hydrate())
bot.use(async (ctx, next) => {
    const telegramUser =
        ctx.update?.message?.from ??
        ctx.update?.callback_query?.from ??
        ctx.update?.my_chat_member?.from
    if (telegramUser) {
        const last_active = Date.now()
        ctx.user = (
            await db.col.users.findOneAndUpdate(
                { id: telegramUser.id },
                {
                    $set: {
                        ...telegramUser,
                        last_active,
                        is_active: true,
                    },
                },
                { upsert: true }
            )
        ).value
    } else {
        log.warn('unknown action user update', ctx)
    }
    return next()
})
const changeThresholdQuestion = new StatelessQuestion(
    'question:threshold',
    async function (ctx, docId) {
        const threshold = parseInt(ctx.msg.text)
        if (isNaN(threshold))
            return await this.replyWithMarkdown(ctx, 'should be number!', docId)
        if (threshold <= 0 || threshold > 50)
            return await this.replyWithMarkdown(
                ctx,
                'should be between 0 and 50!',
                docId
            )
        await db.col.nodeSubscriptions.updateOne(
            { _id: ObjectId(docId) },
            { $set: { threshold } }
        )
        return await ctx.reply(
            'The threshold has successfully changed. You can check in your watch list /list_nodes.'
        )
    }
)
const changeMinStakeThresholdQuestions = new StatelessQuestion(
    'question:threshold-min-stake',
    async function (ctx, docId) {
        const minStakeThresholdSmall = parseInt(ctx.msg.text)
        if (isNaN(minStakeThresholdSmall))
            return await this.replyWithMarkdown(ctx, 'should be number!', docId)
        const minStakeThreshold = new BigNumber(minStakeThresholdSmall)
            .multipliedBy(1000000000)
            .toString()
        await db.col.poolSubscriptions.updateOne(
            { _id: ObjectId(docId) },
            { $set: { minStakeThreshold } }
        )
        return await ctx.reply(
            'The threshold has successfully changed, when pool reach this minimal stake I will notify you. You can check in your watch list /list_pools.'
        )
    }
)

bot.use(changeThresholdQuestion.middleware())
bot.use(changeMinStakeThresholdQuestions.middleware())
bot.on('callback_query:data', async (ctx) => {
    // return
    const [type, data] = register.getMenuData(ctx.callbackQuery.data)
    const actions = {
        'inline:delete-sub': async () => {
            await db.col.nodeSubscriptions.deleteOne({ _id: ObjectId(data) })
            await ctx.msg.delete()
            await ctx.reply(
                'You have successfully deleted node from your watch list'
            )
        },
        'inline:toggle-notification': async () => {
            const sub = await db.col.nodeSubscriptions.findOneAndUpdate(
                { _id: ObjectId(data) },
                [{ $set: { isNotify: { $not: '$isNotify' } } }],
                {
                    returnNewDocument: true,
                    returnOriginal: false,
                    returnDocument: 'after',
                }
            )
            try {
                await ctx.api.editMessageReplyMarkup(
                    ctx.msg.chat.id,
                    ctx.update.callback_query.message.message_id,
                    {
                        reply_markup: createSubNodeBtns(sub.value),
                        parse_mode: 'Markdown',
                    }
                )
            } catch (e) {
                log.warn('editMessageError', e)
            }
        },
        'inline:change-threshold': async () => {
            await changeThresholdQuestion.replyWithMarkdown(
                ctx,
                'Enter your threshold between 0 and 50?',
                data
            )
        },
        'inline:toggle-pool-free-place': async () => {
            const subPool = await db.col.poolSubscriptions.findOneAndUpdate(
                { _id: ObjectId(data) },
                [
                    {
                        $set: {
                            isNotifyAboutFreePlace: {
                                $not: '$isNotifyAboutFreePlace',
                            },
                        },
                    },
                ],
                {
                    returnNewDocument: true,
                    returnOriginal: false,
                    returnDocument: 'after',
                }
            )
            try {
                await ctx.api.editMessageReplyMarkup(
                    ctx.msg.chat.id,
                    ctx.update.callback_query.message.message_id,
                    {
                        reply_markup: createSubPoolBtns(subPool.value),
                        parse_mode: 'Markdown',
                    }
                )
            } catch (e) {
                log.warn('editMessageError', e)
            }
        },
        'inline:delete-pool-sub': async () => {
            await db.col.poolSubscriptions.deleteOne({ _id: ObjectId(data) })
            await ctx.msg.delete()
            await ctx.reply(
                'You have successfully deleted pool from your watch list'
            )
        },
        'inline:toggle-pool-min-stake': async () => {
            const sub = await db.col.poolSubscriptions.findOne({
                _id: ObjectId(data),
            })
            if (sub.minStakeThreshold) {
                const subPool = await db.col.poolSubscriptions.findOneAndUpdate(
                    { _id: ObjectId(data) },
                    [
                        {
                            $set: {
                                isNotifyWithMinimalStake: {
                                    $not: '$isNotifyWithMinimalStake',
                                },
                            },
                        },
                    ],
                    {
                        returnNewDocument: true,
                        returnOriginal: false,
                        returnDocument: 'after',
                    }
                )
                try {
                    await ctx.api.editMessageReplyMarkup(
                        ctx.msg.chat.id,
                        ctx.update.callback_query.message.message_id,
                        {
                            reply_markup: createSubPoolBtns(subPool.value),
                            parse_mode: 'Markdown',
                        }
                    )
                } catch (e) {
                    log.warn('editMessageError', e)
                }
                return true
            }
            await changeMinStakeThresholdQuestions.replyWithMarkdown(
                ctx,
                'Enter minimal amount of stake for notification?',
                data
            )
        },
        'inline:change-pool-threshold': async () => {
            await changeMinStakeThresholdQuestions.replyWithMarkdown(
                ctx,
                'Enter minimal amount of stake for notification?',
                data
            )
        },
    }
    const action = actions[type]
    return action()
})
function positionMsg(recentPos, threshold) {
    if (recentPos === null) return `❌ Out of top`
    if (threshold >= recentPos) return `${recentPos} ✅`
    return `${recentPos} ❌ Lower than specified threshold`
}
function createNodeSubMessage(sub) {
    return `
	Pool ID: ${sub.pool.id}
	Account: ${sub.node.account}
	Amount:***${toHumanReadable(sub.node.amount)}*** $KYVE
	Moniker: ${sub.node.moniker}
	Position: ${positionMsg(sub.node.recent_position, sub.threshold)}
	Commission: ${sub.node.commission * 100} %
	Threshold: ${sub.threshold} 
	------- Pool info --------
	***${sub.pool.name}***
	Min stake: ***${toHumanReadable(sub.pool.min_stake)}*** $KYVE
	Paused: ${sub.pool.paused}       
	`.trim()
}
function createPoolSubMessage(sub) {
    return `
    Pool ID: ${sub.pool.id}
	Name: ${sub.pool.name}
	Min stake: ***${
        sub.pool.numberOfStakers < config.DEFAULT_THRESHOLD
            ? 0
            : toHumanReadable(sub.pool.min_stake)
    }*** $KYVE
	Min stake threshold: ${
        sub.minStakeThreshold
            ? `${toHumanReadable(sub.minStakeThreshold)} $KYVE`
            : `***Doesn't set***`
    }
	Number of validators: ${sub.pool.stakers.length}     
	----------------------------------------------------                                                                
	`
}
const helpCTL = async (ctx) => {
    const message = `
The bot helps you to track your nodes. 
Your own nodes or nodes in which you delegate.
It's simple to use!
1. To start track a node send in bot message in this format
<pool id>:<node address>
example:
***0:kyve1a70hqszqg2ntuqkqt4wwp6vxmm859l2pd3zhmk***

2. To start track a pool to get notification about free place:
pool:<pool id>
example:
***pool:0***

You can add maximum ${config.MAXIMUM_SUBSCRIPTIONS} nodes, for now`
    await ctx.reply(message, { parse_mode: 'Markdown' })
    if (config.HELP_ANIMATION_ID) {
        return ctx.replyWithAnimation(config.HELP_ANIMATION_ID)
    }
}
bot.command('help', helpCTL)
bot.command('start', helpCTL)
bot.command('list_pools', async (ctx) => {
    const user = ctx.update?.message?.from
    const subscriptions = (
        await db.col.poolSubscriptions
            .aggregate([
                { $match: { user: user.id } },
                {
                    $lookup: {
                        from: 'pools',
                        localField: 'pool_id',
                        foreignField: 'id',
                        as: 'pool',
                    },
                },
            ])
            .toArray()
    ).map((it) => ({ ...it, pool: it.pool[0] }))

    if (!subscriptions.length)
        return ctx.reply("You don't have any pools in your watch list")
    for (let sub of subscriptions) {
        await ctx.reply(createPoolSubMessage(sub), {
            reply_markup: createSubPoolBtns(sub),
            parse_mode: 'Markdown',
        })
    }
})
bot.command('support_us', async (ctx) => {
    return ctx.reply(
        `
To support us, you can just delegate one of our nodes : )
https://mellifera.network

COSMOS: cosmos1qcual5kgmw3gqc9q22hlp0aluc3t7rnsprewgy
JUNO: juno1qcual5kgmw3gqc9q22hlp0aluc3t7rnsh3640c
OSMOSIS: osmo1qcual5kgmw3gqc9q22hlp0aluc3t7rnsfc277k
    `,
        { parse_mode: 'Markdown' }
    )
})
bot.command('list_nodes', async (ctx) => {
    const user = ctx.update?.message?.from
    const subscriptions = (
        await db.col.nodeSubscriptions
            .aggregate([
                { $match: { user: user.id } },
                {
                    $lookup: {
                        from: 'nodes',
                        localField: 'uniqueNodeAddress',
                        foreignField: 'uniqueNodeAddress',
                        as: 'node',
                    },
                },
                {
                    $lookup: {
                        from: 'pools',
                        localField: 'pool_id',
                        foreignField: 'id',
                        as: 'pool',
                    },
                },
            ])
            .toArray()
    ).map((it) => ({ ...it, node: it.node[0], pool: it.pool[0] }))

    if (!subscriptions.length)
        return ctx.reply("You don't have any nodes in your watch list")
    for (let sub of subscriptions) {
        await ctx.reply(createNodeSubMessage(sub), {
            reply_markup: createSubNodeBtns(sub),
            parse_mode: 'Markdown',
        })
    }
})
bot.on('message', async (ctx) => {
    const rawStr = ctx.msg.text
    const str = rawStr.trim().toLowerCase()
    const [part1, part2] = str.split(':')
    if (part1 === 'pool' && !Number.isNaN(parseInt(part2)))
        return poolHandlerBot(ctx, part1, part2)
    if (!Number.isNaN(parseInt(part1)) && part2?.length)
        return nodeHandlerBot(ctx, part1, part2)

    return ctx.reply(
        "Sorry, I don't understand you :( Make sure that you make correct input! <pool address>:<node address > or pool:<pool id> /help "
    )
})
async function poolHandlerBot(ctx, _, poolId) {
    const poolData = await kyveAPI.getPoolById(poolId)
    if (!poolData) return ctx.reply(`Can't find pool :(`)

    const validators = await getValidatorsByPoolId(poolData.id)
    const lowest_validator = validators.find(
        (it) => it.account === poolData.lowest_staker
    )
    poolData.min_stake = lowest_validator.amount
    poolData.numberOfStakers = poolData.stakers.length
    const user = ctx.update?.message?.from
    const isSubExist = await db.col.poolSubscriptions.findOne({
        user: user.id,
        pool_id: poolId.toString(),
    })
    if (isSubExist)
        return ctx.reply(
            'You already have this pool in your watch list! check with command /list_pools '
        )
    const sub = {
        user: user.id,
        isNotifyAboutFreePlace: true,
        isNotifyWithMinimalStake: false,
        minStakeThreshold: null,
        pool_id: poolData.id,
    }
    if (!(await db.col.pools.findOne({ id: poolData.id }))) {
        //add unique index
        await db.col.pools.insertOne({
            ...poolData,
            min_stake_old: poolData.min_stake,
        })
    }
    const result = await db.col.poolSubscriptions.insertOne({
        ...sub,
    })
    const fullSub = {
        ...sub,
        pool: poolData,
    }
    await ctx.reply(createPoolSubMessage(fullSub), {
        reply_markup: createSubPoolBtns({
            ...sub,
            _id: result.insertedId.toString(),
        }),
        parse_mode: 'Markdown',
    })
    return ctx.reply(
        'I will notify you about free place in this pool. To see your pools watch list: /list_pools'
    )
}
async function nodeHandlerBot(ctx, poolId, nodeAddress) {
    const [poolData, validators] = await Promise.all([
        kyveAPI.getPoolById(poolId),
        kyveAPI.getValidatorsByPoolId(poolId),
    ])
    if (!poolData) return ctx.reply('Make sure that pool id is correct')

    const currentNode = validators.find(
        (validator) => validator.account === nodeAddress
    )
    if (!currentNode)
        return ctx.reply(
            `Make sure that your node is in top ${config.DEFAULT_THRESHOLD}`
        )
    const user = ctx.update?.message?.from
    const isSubExist = await db.col.nodeSubscriptions.findOne({
        user: user.id,
        node_address: nodeAddress,
        pool_id: poolId.toString(),
    })
    if (isSubExist)
        return ctx.reply(
            'You already have this node in your watch list! check with command /nodes_list '
        )
    const isPoolExist = await db.col.pools.findOne({ id: poolData.id })
    const lowest_validator = validators.find(
        (it) => it.account === poolData.lowest_staker
    )
    poolData.min_stake = lowest_validator.amount

    if (!isPoolExist) {
        await db.col.pools.insertOne({
            ...poolData,
            min_stake: lowest_validator.amount,
        })
    }
    const countOfSubscription = await db.col.nodeSubscriptions
        .find({ user: user.id })
        .count()
    if (countOfSubscription > config.MAXIMUM_SUBSCRIPTIONS) {
        return ctx.reply('Sorry, you have reached maximum nodes subscriptions')
    }

    if (
        !(await db.col.nodes.findOne({
            uniqueNodeAddress: `${nodeAddress}:${poolId}`,
        }))
    ) {
        //add unique index
        await db.col.nodes.insertOne({
            ...currentNode,
            old_position: currentNode.recent_position,
            uniqueNodeAddress: `${nodeAddress}:${poolId}`,
        })
    }
    const sub = {
        user: user.id,
        pool_id: poolId,
        node_address: nodeAddress,
        threshold: config.DEFAULT_THRESHOLD,
        isNotify: true,
        meta: {
            name: poolData.name,
            runtime: poolData.runtime,
        },
    }
    const result = await db.col.nodeSubscriptions.insertOne({
        ...sub,
        uniqueNodeAddress: `${nodeAddress}:${poolId}`,
    })
    const fullSub = {
        ...sub,
        pool: poolData,
        node: currentNode,
    }
    await ctx.reply(
        createNodeSubMessage({
            _id: result.insertedId.toString(),
            ...fullSub,
            node: currentNode,
        }),
        {
            reply_markup: createSubNodeBtns({
                ...fullSub,
                _id: result.insertedId.toString(),
            }),
            parse_mode: 'Markdown',
        }
    )
    await ctx.reply(
        'I will notify you if the node is out of the top of your threshold'
    )
}
bot.on('my_chat_member').filter(
    async (ctx) =>
        ctx.chat.type === 'private' &&
        ctx.myChatMember.old_chat_member.status === 'member' &&
        ctx.myChatMember.new_chat_member.status === 'kicked',
    async (ctx) => {
        await db.col.users.updateOne(
            { id: ctx.update.my_chat_member.from.id },
            { $set: { is_active: false } }
        )
        await db.col.nodeSubscriptions.deleteMany({
            user: ctx.update.my_chat_member.from.id,
        })
        await db.col.poolSubscriptions.deleteMany({
            user: ctx.update.my_chat_member.from.id,
        })
    }
)
async function main() {
    await db.connect()
    await bot.start()
    await bot.api.setMyCommands([
        { command: 'list_nodes', description: 'Nodes watch list' },
        { command: 'list_pools', description: 'Pools watch list' },
        { command: 'support_us', description: 'How to support us' },
        { command: 'help' },
    ])
}

bot.catch((e) => {
    if (e?.error?.isAxiosError) {
        log.fatal(
            `<${e.ctx.chat.id}> HttpClient error`,
            'url:',
            e.error.request.path,
            e.error.message
        )
        return e.ctx.reply(
            'Something wrong with network, please try again. support: @ruslangl'
        )
    }
    log.fatal(`<${e.ctx.chat.id}>`, e)
    return e.ctx.reply('Something went wrong, please contact @ruslangl')
})

main().catch((e) => log.fatal(e))
