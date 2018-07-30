/**
 * @fileoverview ESLint rule to disallow unsanitized injection
 * @author Yoni Jah.
 */
'use strict';

const defaultRuleChecks = {
	output: true,
	inputs: {
		properties : [
			// ['input', 'value'],
			// /^get.*/,
			'value'
		],
		methods : [
			// 'val',
			// 'ajax'
		]
	},
	injections: {
		html : {
			valnurable: {
				properties: [
					'innerHTML',
					'outerHTML'
				],
				methods: [
					'html'
				]
			},
			sanitizers: [
				'escapeHTML'
			]
		}
	}
};

const Helpers = require('../helpers.js');

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
	meta: {
		docs: {
			description: 'ESLint rule to disallow sensitive use of unsanitized input',
			category: 'possible-errors',
			url: 'https://github.com/yonjah/eslint-plugin-no-injection'
		}
	},
	create(context) {
		const settings = {
			injections: Object.assign({}, defaultRuleChecks.injections, context.injections),
			inputs: Object.assign({}, defaultRuleChecks.inputs, context.inputs)
		};

		const output = context.output || defaultRuleChecks.output;

		const h = new Helpers({context, settings});

		return {
			Identifier (node) {
				if (settings.inputs.properties && h.checkIdentifierInList(settings.inputs.properties, node)) {
					h.markIdentifier(node);
				} else {
					h.logger('Not Adding mark unsanitizedInput', node);
				}
			},

			'Program:exit' (node) {
				output && h.logMarkers(node);
			},

			'CallExpression:exit' (node) {
				const marks = [];
				const insecureArgs = [];

				h.logger('Checking if unsanitizedInput is used as call args', node);
				node.arguments.forEach((arg, i) => {
					h.logger(2, 'testing argument', arg);
					const mark = h.getMark('unsanitizedInput', arg);
					if (mark) {
						insecureArgs.push(i);
						marks.push(mark);
					}
				});

				if (!insecureArgs.length) {
					h.logger('no unsanitizedInput args',  node);
					return;
				}

				h.logger('found unsanitizedInput args', insecureArgs.join(','),  node);
				h.setMark('unsanitizedInput', node, marks[0]); //we can only set a single mark, might need to revisit this for better report

				const funcNode = h.findFunction(node);

				if (funcNode) {
					h.logger(2, 'Found function defenition', funcNode);
					insecureArgs.forEach((i) => {
						const arg = node.arguments[i];
						const param = funcNode.params[i];
						const name = param.name;
						h.logger(2, 'moving into argument param', param);
						h.walkNode(funcNode.body, (node) => {
							if (node.type === 'Identifier' && node.name === name && node.parent.type !== 'MemberExpression') {
								h.markIdentifier(node, marks[i]);
							}
						});
					});
				} else  {
					h.logger(2, 'Could not find function definition for call', node);
				}
			}
		};
	}
};
