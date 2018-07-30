/**
 * @fileoverview Test for smart injection rule
 * @author Yoni Jah
 */

const fs         = require('fs');
const path       = require('path');
// const rule       = require('../../lib/rules/smart');
const rule       = require('../../lib/rules/oneWay');
const code       = require('./codeStrings');
const RuleTester = require('eslint').RuleTester;

const eslintTester = new RuleTester();

const codePath = path.join(__dirname,  '../code_files');
const files = fs.readdirSync(codePath);

const errorUnsanitized = {message: 'Used with unsanitized input', type: 'CallExpression'};
const errorInjected    = {message: 'Inserted unsanitized as html', type: 'Identifier'};

const valid   = [{code: 'var a=1+1;', parserOptions: {ecmaVersion: 6}}];
const invalid = [{
	code: `${code.unsafe.InsecureDataHandler}\nInsecureDataHandler(input.value);`,
	errors: [errorUnsanitized, errorInjected],
	parserOptions: {ecmaVersion: 6}
}];

files.forEach((file) => {
	if (file.indexOf('_test') >= 0) {
		const code = fs.readFileSync(path.join(codePath, file)).toString();
		if (file.indexOf('_valid_') >= 0) {
			eslintTester.run(`file: ${file.split('_')[0]}`, rule, {invalid, valid: [{code, parserOptions: {ecmaVersion: 6}}]});
		} else {
			eslintTester.run(`file: ${file.split('_')[0]}`, rule, {invalid: [{code, errors: [errorUnsanitized, errorInjected], parserOptions: {ecmaVersion: 6}}], valid});
		}
	}
});

// eslintTester.run('property', rule, {invalid, valid});