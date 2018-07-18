/**
 * @fileoverview ESLint rule to disallow unsanitized injection
 * @author Yoni Jah.
 */
'use strict';

const defaultRuleChecks = {
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

		const h = new Helpers({context});

		return {
			Identifier (node) {
				if (settings.inputs.properties && h.checkIdentifierInList(settings.inputs.properties, node)) {
					const index = h.getNodeIndex(node);
					h.setMark('unsanitizedInput', node, index);
					let parent = node.parent;
					while (parent.type === 'MemberExpression') {
						h.setMark('unsanitizedInput', parent, index);
						parent = parent.parent;
					}
				} else {
					h.logger('Not Adding mark unsanitizedInput', node);
				}

				const assignment = h.getAssignment(node);
				if (assignment) {
					Object.keys(settings.injections).forEach(key => {
						const injection = settings.injections[key];
						if (injection.valnurable.properties && h.checkIdentifierInList(injection.valnurable.properties, node)) {
							const index = h.getNodeIndex(node);
							h.setMark(`${key}Injected`, node, index);
							h.traverseNode(assignment.right, (node) => {
								if (node.type === 'Identifier') {
									h.markInsecureCall(key, index, node);
								}
							});
						}
					});
				}
			},

			CallExpression (node) {
				let callee;
				if (node.callee.type === 'Identifier') {
					callee = node.callee;
				} else if (node.callee.type === 'MemberExpression') {
					callee = node.callee.property;
				}

				if (callee) {
					Object.keys(settings.injections).forEach(key => {
						const injection = settings.injections[key];
						if (injection.valnurable.methods && h.checkIdentifierInList(injection.valnurable.methods, callee)) {
							h.setMark(`${key}Injected`, node, h.getNodeIndex(node));
							node.arguments.forEach(arg => h.markInsecureCall(key, h.getNodeIndex(arg), arg));
						}

						if (injection.sanitizers && h.checkIdentifierInList(injection.sanitizers, callee)) {
							h.setMark(`${key}Sanitized`, node, h.getNodeIndex(node));
						}
					});

					if (settings.inputs.methods && h.checkIdentifierInList(settings.inputs.methods, node)) {
						h.setMark('unsanitizedInput', node, h.getNodeIndex(node));
					}
				} else {
					h.logger(8, 'Could not find callee', node);
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
