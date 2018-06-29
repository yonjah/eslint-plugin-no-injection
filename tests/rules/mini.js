/**
 * @fileoverview Test for smart injection rule
 * @author Yoni Jah
 */

const rule = require('../../lib/rules/smart');
const RuleTester = require('eslint').RuleTester;

const eslintTester = new RuleTester();

const code = require('./codeStrings');

eslintTester.run('property', rule, {
	invalid: [
		{
			code: `
				${code.unsafe.InsecureMsgHandler}
				InsecureMsgHandler(input.value);
			`,
			parserOptions: { ecmaVersion: 6 },
			errors: [
				{ message: 'Used with unsanitized input',
					type: 'BinaryExpression' },
				{ message: 'Inserted into HTML',
					type: 'MemberExpression' }
			]
		}
	],
	valid: [
		{
			code: `
				${code.unsafe.InsecureMsgHandler}
				InsecureMsgHandler(input.value);
			`,
			parserOptions: { ecmaVersion: 6 }
		}
		// {
		// 	code: `
		// 		${code.unsafe.InsecureDataHandler}
		// 		function getVal () {
		// 			return input.value;
		// 		}
		// 		var val = getVal;
		// 		InsecureDataHandler(val);
		// 	`
		// },
		// {
		// 	code: `
		// 		${code.unsafe.InsecureDataHandler}
		// 		function getVal () {
		// 			return input.value;
		// 		}
		// 		InsecureDataHandler(getVal);
		// 	`
		// }
	]
});
