/**
 * @fileoverview Test for smart injection rule
 * @author Yoni Jah
 */

const rule       = require('../../lib/rules/smart');
const code       = require('./codeStrings');
const RuleTester = require('eslint').RuleTester;

const eslintTester = new RuleTester();

const errorUnsanitized = {message: 'Used with unsanitized input', type: 'Identifier'};
const errorInjected    = {message: 'Inserted unsanitized as html', type: 'Identifier'};

eslintTester.run('property', rule, {
	invalid: [
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				InsecureDataHandler(input.value);
			`,
			errors: [errorUnsanitized, errorInjected]
		},
		{
			code: `
				InsecureDataHandler(input.value);
				${code.unsafe.InsecureDataHandler}
			`,
			errors: [errorInjected, errorUnsanitized]
		},
		{
			code: `
				var InsecureDataHandler = ${code.unsafe.InsecureDataHandler};
				InsecureDataHandler(input.value);
			`,
			errors: [errorUnsanitized, errorInjected]
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				var val = input.value;
				InsecureDataHandler(val);
			`,
			errors: [errorUnsanitized, errorInjected]
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				function getVal () {
					return input.value;
				}
				InsecureDataHandler(getVal());
			`,
			errors: [errorUnsanitized, errorInjected]
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				function getVal () {
					return input.value;
				}
				var val = getVal();
				InsecureDataHandler(val);
			`,
			errors: [errorUnsanitized, errorInjected]
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				InsecureDataHandler(JSON.stringify(input.value));
			`,
			errors: [errorUnsanitized, errorInjected]
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				var val = JSON.stringify(input.value);
				InsecureDataHandler(val);
			`,
			errors: [errorUnsanitized, errorInjected]
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				function getVal () {
					return JSON.stringify(input.value);
				}
				var val = getVal();
				InsecureDataHandler(val);
			`,
			errors: [errorUnsanitized, errorInjected]
		},
		{
			code: `
				${code.unsafe.InsecureMsgHandler}
				InsecureMsgHandler(input.value);
			`,
			parserOptions: { ecmaVersion: 6 },
			errors: [
				{ message: 'Used with unsanitized input',
					type: 'BinaryExpression' },
				{ message: 'Inserted unsanitized as html',
					type: 'Identifier' }
			]
		},
		{
			code: `
				${code.unsafe.InsecureMsgHandler}
				function getVal () {
					return JSON.stringify(input.value);
				}
				var val = getVal();
				InsecureMsgHandler(val);
			`,
			parserOptions: { ecmaVersion: 6 },
			errors: [
				{ message: 'Used with unsanitized input',
					type: 'BinaryExpression' },
				{ message: 'Inserted unsanitized as html',
					type: 'Identifier' }
			]
		}
	],
	valid: [
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				InsecureDataHandler('string');
			`
		},
		{
			code: `
				InsecureDataHandler('string');
				${code.unsafe.InsecureDataHandler}
			`
		},
		{
			code: `
				var InsecureDataHandler = ${code.unsafe.InsecureDataHandler};
				InsecureDataHandler('string');
			`
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				var val = 'string';
				InsecureDataHandler(val);
			`
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				function getVal () {
					return 'string';
				}
				InsecureDataHandler(getVal());
			`
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				function getVal () {
					return 'string';
				}
				var val = getVal();
				InsecureDataHandler(val);
			`
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				function getVal () {
					return input.value;
				}
				var val = getVal;
				InsecureDataHandler(val);
			`
		},
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				function getVal () {
					return input.value;
				}
				InsecureDataHandler(getVal);
			`
		},
		{
			code: `
				${code.safe.SecureDataHandler}
				SecureDataHandler(input.value);
			`
		}
	]
});
