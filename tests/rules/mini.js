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

const valid   = [{code: 'var a=1+1;', parserOptions: {ecmaVersion: 6}}];
const invalid = [{
	code: `${code.unsafe.InsecureDataHandler}\nInsecureDataHandler(input.value);`,
	errors: [errorUnsanitized, errorInjected],
	parserOptions: {ecmaVersion: 6}
}];

eslintTester.run('property', rule, {invalid, valid});

eslintTester.run('property', rule, {
	invalid: [
		{
			code: `
				${code.unsafe.InsecureDataHandler}
				InsecureDataHandler(input.value);
			`,
			errors: [errorUnsanitized, errorInjected]
		}
	],
	valid: [
		{
			code: `
				${code.safe.SecureDataHandler}
				SecureDataHandler(input.value);
			`
		}
	]
});