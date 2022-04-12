const db = require('./db')
const bot = require('./bot')
const log = require('./logger').Logger('message')
const fs = require('fs')
module.exports = async function main(messageName) {
    const files = fs.readdirSync('./messages')
    const file = files.find((fn) => fn.split(':')[0] === messageName)
    if (!file)
        return log.error(
            "Can't find message. Available messages:",
            files.map((it) => it.split(':')[0])
        )
    const message = fs.readFileSync(`./messages/${file}`, 'utf-8')
    await db.connect()
    const users = await db.col.users.find({ is_active: true }).toArray()
    for (let user of users) {
        try {
            await bot.api.sendMessage(user.id, message, {
                parse_mode: 'MarkdownV2',
            })
            log.info('message successfully send to user', user.id)
        } catch (e) {
            log.error('Message fail. user:', user.id)
            log.error(e.description)
        }
    }
    process.exit(0)
}
