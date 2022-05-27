const commander = require('commander')
const configManager = require('./src/config-manager')
const log = require('./src/logger')

const program = new commander.Command().option(
    '-c, --config <path_to_config>',
    'Set a config file'
)

program
    .command('bot')
    .description('Run a bot')
    .action(() => {
        configManager.init(program.opts().config)
        log.Logger('BOT').info('BOT starting...')
        require('./src/bot-start')
    })

program
    .command('notifier')
    .description('Run a notifier')
    .action(() => {
        configManager.init(program.opts().config)
        log.Logger('BOT').info('Notifier starting...')
        require('./src/notifier')
    })
program
    .command('updater')
    .description('Run updater')
    .action(() => {
        configManager.init(program.opts().config)
        log.Logger('BOT').info('Updater starting...')
        require('./src/updater')
    })
program
    .command('message')
    .description('Send message to users')
    .argument(
        '<message_name>',
        'name of message located in messages folder, until ":" sign'
    )
    .action(async (messageName) => {
        configManager.init(program.opts().config)
        log.Logger('BOT').info('START message...')
        const execute = require('./src/message')
        await execute(messageName)
    })
program
    .command('migrate')
    .description('run migration script ')
    .action(async () => {
        configManager.init(program.opts().config)
        log.Logger('BOT').info('START migrate...')
        require('./migrations/migrations')
    })
program.parse()
