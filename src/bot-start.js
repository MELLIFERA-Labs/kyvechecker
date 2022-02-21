const db = require('./db');
const config = require('./../config');
const kyveAPI = require('./kyve-api');
const bot = require('./bot')
const {ObjectId} = require("mongodb");
const {toHumanReadable} = require('./utils');
const {createSubBtns} = require('./keyboard/subscriptions.inline');
const {register} = require('./utils');
const { hydrate } = require("@grammyjs/hydrate");
const log = require('./logger').Logger('bot');
const { StatelessQuestion } = require("@grammyjs/stateless-question");

bot.use(hydrate());
bot.use(async (ctx, next) => {
	const telegramUser =
		ctx.update?.message?.from ??
		ctx.update?.callback_query?.from ??
		ctx.update?.my_chat_member?.from;
	if (telegramUser) {
		const last_active = Date.now();
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
		).value;
	} else {
		log.warn("unknown action user update", ctx);
	}
	return next();
});
const changeThresholdQuestion = new StatelessQuestion(
	"question:threshold",
	async function (ctx, docId) {
		const threshold = parseInt(ctx.msg.text);
		if(isNaN(threshold)) return await this.replyWithMarkdown(ctx, 'should be number!', docId)
		if (threshold <= 0 || threshold > 20) return await this.replyWithMarkdown(ctx, 'should be between  0 and 20!', docId)
		await db.col.subscriptions.updateOne({_id: ObjectId(docId)}, {$set: { threshold }})
		return await ctx.reply('The threshold has successfully changed. You can check in your watch list /list.');
	}
);

bot.use(changeThresholdQuestion.middleware());
bot.on("callback_query:data", async (ctx) => {
	// return
	const [type, data] = register.getMenuData(ctx.callbackQuery.data);
	const actions = {
		'inline:delete-sub': async () => {
			await db.col.subscriptions.deleteOne({_id: ObjectId(data)});
			await ctx.msg.delete();
			await ctx.reply("You have successfully deleted node from your watch list");
		},
		'inline:toggle-notification': async () => {
			const sub = await db.col.subscriptions.findOneAndUpdate({_id: ObjectId(data)},[
				{ $set: { isNotify: { $not: "$isNotify" } } }
			], {"returnNewDocument": true, returnOriginal: false, returnDocument: "after"});
			try {
				await ctx.api.editMessageReplyMarkup(ctx.msg.chat.id, ctx.update.callback_query.message.message_id, {reply_markup: createSubBtns(sub.value), 	parse_mode: "Markdown"})
			}catch (e) {
				log.warn('editMessageError', e);
			}

		},
		'inline:change-threshold': async () => {
			await changeThresholdQuestion.replyWithMarkdown(ctx, "Enter your threshold between 0 and 20?", data);
		}
	}
	const action = actions[type];
	return action();
});
function positionMsg(recentPos, threshold) {
	if(recentPos === null) return `❌ Out of top`
	if(threshold >= recentPos) return `${recentPos} ✅`
	return `${recentPos} ❌ Lower than specified threshold`
}
function createSubMessage(sub) {
	return `
	Node address: ${sub.node_address}
	Pool address: ${sub.pool_id}
	Total delegators: ${sub.node.totalDelegators}
	Total staked: ***${toHumanReadable(sub.node.totalStaked)}*** $KYVE
	Expected APY: ***${toHumanReadable(sub.node.apy)}*** %
	Total proposals: ${sub.node.proposalsValidated}
	Position: ${positionMsg(sub.node.recent_position, sub.threshold)}
	Threshold: ${sub.threshold} 
	------- Pool info --------
	***${sub.node.pool.metadata.name}***
	Min stake: ***${toHumanReadable(sub.node.pool.minStake)}*** $KYVE
	Paused: ${sub.node.pool.paused}       
	`;
}
const helpCTL = async (ctx) => {
	const message = `
The bot helps you to track your nodes. 
Your own nodes or nodes in which you delegate.
It's simple to use!
To start track a node send in bot message in this format
<pool id>:<node address>
example:
0x24E7b48c3a6E40ea0e50764E617906c9B7cf9F21:0x5120d9346E3Cb8CB99acc88ffc804f3bb8391E1B

You can add maximum ${config.MAXIMUM_SUBSCRIPTIONS} nodes, for now`
	await ctx.reply(message);
	if(config.HELP_ANIMATION_ID) {
		return ctx.replyWithAnimation(
			config.HELP_ANIMATION_ID
		);
	}
}
bot.command('help', helpCTL);
bot.command('start', helpCTL);
bot.command('list', async (ctx) => {
	const user = ctx.update?.message?.from;
	const subscriptions = (await db.col.subscriptions.aggregate([
		{ $match: { user: user.id } },
		{
			$lookup: {
				from: 'nodes',
				localField: 'node_address',
				foreignField: 'nodeAddress',
				as: 'node'
			}
		}]).toArray()).map(it => ({...it, node: it.node[0]}));

	if (!subscriptions.length) return ctx.reply('You don\'t have any nodes on your watch list');
	for (let sub of subscriptions) {
		await ctx.reply(
			createSubMessage(sub),
			{
				reply_markup: createSubBtns(sub),
				parse_mode: "Markdown",
			}
		);
	}

});
bot.on("message", async (ctx) => {
	const str = ctx.msg.text;
	const [poolId, nodeAddress] = str.split(":");
	if (!poolId || !nodeAddress || poolId.length !== 42 || nodeAddress.length !== 42) {
		return ctx.reply("Sorry, I don't understand you :( Make sure that you make correct input! <poll address>:<node address >    ");
	}
	const poolData = await kyveAPI.getPoolValidators(poolId);
	if (!poolData) return ctx.reply('Make sure that pool id is correct');
	const currentNode = poolData.find(validator => validator.nodeAddress === nodeAddress);
	if (!currentNode) return ctx.reply(`Make sure that your node is in top ${config.DEFAULT_THRESHOLD}`);
	const user = ctx.update?.message?.from;
	const isSubExist = await db.col.subscriptions.findOne({
		user: user.id,
		node_address: nodeAddress
	});
	if (isSubExist) return ctx.reply("You already have this node in your watch list! check with command /list ");
	const countOfSubscription = await db.col.subscriptions.find({user: user.id}).count();
	if (countOfSubscription > config.MAXIMUM_SUBSCRIPTIONS) {
		return ctx.reply('Sorry, you have reached maximum nodes subscriptions');
	}

	if (!(await db.col.nodes.findOne({nodeAddress}))) {
		//add unique index
		await db.col.nodes.insertOne({...currentNode});
	}
	const sub = {
		user: user.id,
		pool_id: poolId,
		node_address: nodeAddress,
		threshold: config.DEFAULT_THRESHOLD,
		isNotify: true,
		meta: currentNode.pool.metadata
	}
	const result = await db.col.subscriptions.insertOne(sub);
	await ctx.reply(createSubMessage({_id: result.insertedId.toString(),...sub, node: currentNode }), {
		reply_markup: createSubBtns(sub),
		parse_mode: "Markdown",
	})
	await ctx.reply("I will notify you if the node is out of the top of your threshold");

});
bot.on("my_chat_member").filter(
	async (ctx) =>
		ctx.chat.type === "private" &&
		ctx.myChatMember.old_chat_member.status === "member" &&
		ctx.myChatMember.new_chat_member.status === "kicked",
	async (ctx) => {
		await db.col.users.updateOne(
			{ id: ctx.update.my_chat_member.from.id },
			{ $set: { is_active: false } }
		);
		await db.col.subscriptions.deleteMany({ user: ctx.update.my_chat_member.from.id })
	}
);
async function main() {
	await db.connect();
	await bot.start();
	await bot.api.setMyCommands([
		{ command: "list", description: "watch list" },
		{ command: "help" },
	]);
}

bot.catch((e) => {
	log.fatal(e);
});

main().catch(e => log.fatal(e));