/**
 * @fileoverview Test for smart injection rule
 * @author Yoni Jah
 */

const rule       = require('../../lib/rules/oneWay');
const code       = require('./codeStrings');
const RuleTester = require('eslint').RuleTester;

const eslintTester = new RuleTester();

const errorUnsanitized = {message: 'Used with unsanitized input', type: 'CallExpression'};
const errorInjected    = {message: 'Inserted unsanitized as html', type: 'Identifier'};

const valid   = [{code: 'var a=1+1;', parserOptions: {ecmaVersion: 6}}];
const invalid = [{
	code: `${code.unsafe.InsecureDataHandler}\nInsecureDataHandler(input.value);`,
	errors: [errorUnsanitized, errorInjected],
	parserOptions: {ecmaVersion: 6}
}];

// eslintTester.run('property', rule, {invalid, valid});

eslintTester.run('property', rule, {
	invalid: [
		{
			code: `
				function InsecureDataHandler(data) {
                    data = JSON.stringify(data, null, 2);
                    var popupHtml = '<pre class="simplepre">' + data + '</pre>';
                    popupHtml += '<div class="close-icon useCursorPointer" onClick="closeScreenshot();"></div>';
                    $('#screenshot_box').html(popupHtml);
            	}
                function getVal () {
                        return input.value;
                }
                InsecureDataHandler(getVal());
			`,
			errors: [errorUnsanitized, errorInjected]
		}
	],
	valid
});