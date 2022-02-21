const path = require('path');
const configSample = require('./../config.sample');
function checkConfigKeys(config) {
	const configKeys = Object.keys(config);
	Object.entries(configSample)
		.map(([key, value]) => Boolean(value) ? key : null)
		.filter(Boolean).forEach(sampleKey => {
		if(!configKeys.includes(sampleKey)) {
			throw new Error(`Missed \`${sampleKey}\` in config`);
		}
	})
}

function Config() {
	let config = null;
	return {
		init: (configPath) => {
			if (config) return;
			if (configPath) {
				try {
					config = require(path.resolve(process.cwd(), configPath));
					checkConfigKeys(config)
				} catch (e) {
					throw new Error('Error to load config');
				}
			}
			config = require(path.resolve(process.cwd(), 'config.js'));
			checkConfigKeys(config)
		},
		get config() {
			if(!config) throw new Error('Need to call method `init` method first!');
			return config;
		}
	};
}

module.exports = Config();