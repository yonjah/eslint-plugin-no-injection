/**
 * @fileoverview ESLint rule to disallow unsanitized injection
 * @author Yoni Jah.
 */
'use strict';

const defaultRuleChecks = {
	properties: {

		// Check unsafe assignment to innerHTML
		innerHTML: {
		},

		// Check unsafe assignment to outerHTML
		outerHTML: {
		}
	},
	methods: {
		html: {

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
			properties: Object.assign({}, defaultRuleChecks.properties, context.properties),
			methods: Object.assign({}, defaultRuleChecks.methods, context.methods)
		};

		const h = new Helpers({context});

		return {

			MemberExpression (node) {
				if (node.property.type === 'Identifier' && node.property.name === 'value') {
					h.setMark('unsanitizedInput', node, h.getNodeIndex(node));
				} else {
					h.logger('Not Adding mark unsanitizedInput', node);
				}
			},

			'AssignmentExpression:exit': h.bubbleCollection('right', 'unsanitizedInput'),

			'BinaryExpression:exit' (node) {
				const markRight = h.getMark('unsanitizedInput', node.right);
				const markLeft = h.getMark('unsanitizedInput', node.left);
				if (markRight || markLeft) {
					h.setMark('unsanitizedInput', node, markRight || markLeft);
				}
			},

			'VariableDeclarator:exit': h.bubbleCollection('init', 'unsanitizedInput'),

			'ReturnStatement:exit' (node) {
				const mark = h.getMark('unsanitizedInput', node.argument);
				if (mark) {
					h.setMark('unsanitizedInput', node, mark);
					let parent = node.parent;
					while (parent && parent.type.indexOf('Function') === -1) {
						h.setMark('unsanitizedInput', parent, mark);
						parent = parent.parent;
					}
				}
			},

			'Identifier:exit' (node) {
				const variable = h.findVariable(node);
				const def = h.getVariableDefinition(variable);
				if (def) {
					const mark = h.getMark('unsanitizedInput', def.node);
					if (mark) {
						h.setMark('unsanitizedInput', node, mark);
					} else {
						h.logger('Not marking', node, 'defined', def.node);
					}
				} else {
					h.logger(7, 'Could not find variable definition', node, variable);
				}

			},

			CallExpression (node) {
				if (node.callee.type === 'MemberExpression') {
					const id = node.callee.property.name;

					if (settings.methods[id]) {
						h.setMark('htmlInjected', node, h.getNodeIndex(node));
						node.arguments.forEach(arg => h.markInsecureCall(h.getNodeIndex(arg), arg));
					}
				}
			},

			'CallExpression:exit' (node) {
				const funcNode = h.findFunction(node);
				h.logger(2, 'Checking call', node);
				if (funcNode) {
					h.logger(2, 'Found function defenition', funcNode);
					node.arguments.forEach((arg, i) => {
						const param = funcNode.params[i];
						h.logger(2, 'testing argument', arg, 'with param', param);
						const mark = h.getMark('unsanitizedInput', arg);
						if (mark) {
							h.setMark('unsanitizedInput', param, mark);
						} else {
							h.logger('Not Marking param', param,  'from arg', arg);
						}
						h.testViolation(arg, param);
					});
					const mark = h.getMark('unsanitizedInput', funcNode.body);
					if (mark) {
						h.setMark('unsanitizedInput', node, mark);
					} else {
						h.logger('Not marking call as unsanitizedInput');
					}
				} else  {
					h.logger(2, 'Could not find function definition for call', node);
					node.arguments.some((arg) => {
						const mark = h.getMark('unsanitizedInput', arg);
						if (mark) {
							h.logger('Marking call as unsanitizedInput from arg', arg);
							h.setMark('unsanitizedInput', node, mark);
							return true;
						} else {
							h.logger('Argument is considered safe', arg);
						}
					});
				}
			},

			/**
			 * This is called at the start of analyzing a code path.
			 * In this time, the code path object has only the initial segment.
			 *
			 * @param {CodePath} codePath - The new code path.
			 * @param {ASTNode} node - The current node.
			 * @returns {void}
			 */
			onCodePathStart (codePath, node) {
				// do something with codePath
				// console.log(codePath);
				// console.log('onCodePathStart', node.type, node.start, node.end);
			},

			/**
			 * This is called at the end of analyzing a code path.
			 * In this time, the code path object is complete.
			 *
			 * @param {CodePath} codePath - The completed code path.
			 * @param {ASTNode} node - The current node.
			 * @returns {void}
			 */
			onCodePathEnd (codePath, node) {
				// do something with codePath
				// console.log(codePath);
				// console.log('onCodePathEnd', node.type, node.start, node.end);
				if (node.type === 'Program') {
					// console.log(node);
				}
			}
		};
	}
};
