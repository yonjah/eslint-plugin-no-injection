/* global module, require */
module.exports = {
	rules: {
		'smart': require('./lib/rules/smart')
	},
	configs: {
		Default: {
			rules: {
				'no-injection/smart': [
					'error',
					{
					},
					{
					}
				]
			}
		}
	}
};