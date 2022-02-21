const commander = require('commander');
const configManager = require('./src/config-manager');
const log = require('./src/logger')

const program = new commander.Command()
	.option('-c, --config <path_to_config>', 'Set a config file');

program
	.command('bot')
	.description('Run a bot')
	.action(() =>  {
		configManager.init(program.opts().config);
		log.Logger('BOT').info('BOT starting...')
		require('./src/bot-start');
	});

program
	.command('notifier')
  .description('Run a notifier')
	.action(() => {
		configManager.init(program.opts().config);
		log.Logger('BOT').info('Notifier starting...')
		require('./src/notifier');
	});

program.parse();


