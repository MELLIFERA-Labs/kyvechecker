const { Bot } = require("grammy");
const config = require('./../config');
const bot = new Bot(config.BOT_TOKEN);

module.exports = bot;