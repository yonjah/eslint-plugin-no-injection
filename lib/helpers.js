/**
 * @fileoverview ESLint helpers to analyze and find nodes on tree
 * @author Yoni Jah.
 */
'use strict';

const ignoreKeys = ['parent'];

const collections = {
	htmlSanitized: [],
	htmlInjected: [],
	unsanitizedInput: []
};

Object.keys(collections).forEach(key => {
	collections[key].marks = [];
});

const nodes = [{}];
const DEBUG = process.env.DEBUG || global.DEBUG || Infinity;


class helpers {
	constructor (args) {
		if (!args.context) {
			throw new Error('Missing context');
		}
		this.context = args.context;
		this.sourceCode = this.context.getSourceCode();
		this.collections = collections;
	}

	/**
	 * logger Helper
	 * @param  {Integer}  [level] log level (will only log if equal or higher  DEBUG level) default 3
	 * @param  {...MIXED} args
	 */
	logger (level, ...args) {
		if (typeof level !== 'number') {
			args.unshift(level);
			level = 1;
		}
		if (level >= DEBUG) {
			console.log.apply(console, args.map(arg => { // eslint-disable-line no-console
				if (arg && arg.type) {
					try {
						if (['Variable', 'FunctionName', 'Parameter'].indexOf(arg.type) >= 0) {
							return this.getCode(arg.name);
						}
						if (arg.type === 'Identifier') {
							return `${arg.name}(${arg.loc.start.line}:${arg.loc.start.column})`;
						}
						return `${arg.type}(${this.getCode(arg)})(${arg.loc.start.line}:${arg.loc.start.column})`;
					} catch (e) {
						console.log(arg); // eslint-disable-line no-console
						console.log(`${this.getCode(arg.parent)} Child Error ${arg.type}`); // eslint-disable-line no-console
						throw e;
					}
				}
				return arg && arg.name || arg;
			}));
			const stack = new Error().stack.split('\n    at ');
			stack.splice(0, 2);
			console.log('\t', stack.splice(0, 2).join('\n\t')); // eslint-disable-line no-console
			if (level === 4) {
				const ruleStack = stack.filter(line => line.indexOf('eslint-test/lib/rules/') >= 0);
				ruleStack.length && console.log('\t', ruleStack.join('\n\t')); // eslint-disable-line no-console
			}
			if (level > 4) {
				stack.length && console.log('\t', stack.join('\n\t')); // eslint-disable-line no-console
			}
		}
	}

	fatal (...args) {
		args.unshift(10);
		this.logger.apply(this, args);
		process.exit(1);
	}

	getCode (node) {
		return this.sourceCode.getText(node);
	}

	/**
	 * walk all child nodes of a node
	 * @param  {Node}   node   main node
	 * @param  {Function} enter   visitor function
	 * @param  {Function} exit   visitor function
	 */
	walkNode (node, enter, exit) {
		Object.keys(node).forEach(key => {
			if (ignoreKeys.indexOf(key) === -1) {
				this.traverseNode(node[key], enter, exit);
			}
		});
	}

	/**
	 * traverse all child nodes of a node
	 * @param  {Node}   node   main node
	 * @param  {Function} enter   visitor function
	 * @param  {Function} exit   visitor function
	 * @return {Undefined} does not return any value
	 */
	traverseNode (node, enter, exit) {
		if (!node) {
			return;
		}
		if (Array.isArray(node)) {
			return node.forEach(child => this.traverseNode(child, enter, exit));
		}
		if (node.type) {
			enter && enter(node);
			Object.keys(node).forEach(key => {
				if (ignoreKeys.indexOf(key) === -1) {
					this.traverseNode(node[key], enter, exit);
				}
			});
			exit && exit(node);
		}
	}


	/**
	 * test if both input and call node are insecure and if so reports errors
	 * @param  {Node} inputNode inputNode to test
	 * @param  {Node} [callNode]  Optional will use inputNode if not set
	 * @return {Boolean}
	 */
	testViolation (inputNode, callNode) {
		callNode = callNode || inputNode;
		const unsanitizedMark = this.getMark('unsanitizedInput', inputNode);
		if (unsanitizedMark) {
			Object.keys(collections).forEach(key => {
				const index = key.indexOf('Injected');
				if (index > 0) {
					const injectionMark = this.getMark(key, callNode);

					if (injectionMark) {
						this.logger(5, 'report unsanitized', inputNode, inputNode.type, 'used on', callNode, callNode.type);
						this.logger(3, 'report mark unsanitized', nodes[unsanitizedMark], 'used on', nodes[injectionMark]);
						this.context.report({
							node: nodes[injectionMark],
							message: 'Used with unsanitized input'
						});

						this.context.report({
							node: nodes[unsanitizedMark],
							message: `Inserted unsanitized as ${key.substring(0, index)}`
						});
						return true;
					}
				}
			});
		}

		return false;
	}

	/**
	 * getNodeIndex return nodes saved index
	 * If Node does not exist adds it in
	 * @param  {Node} node
	 * @return {Integer}
	 */
	getNodeIndex (node) {
		const index = nodes.indexOf(node);
		if (index === -1) {
			return nodes.push(node) - 1;
		}
		return index;
	}

	/**
	 * getMark for specific node
	 * @param  {String}  collectionKey  key of collection
	 * @param  {Node}    node
	 * @return {Integer}
	 */
	getMark (collectionKey, node) {
		const collection = collections[collectionKey];
		if (!collection) {
			throw new Error(`Could not find collection ${collectionKey}`);
		}
		return collection.marks[collection.indexOf(node)];
	}

	/**
	 * setMark for specific node
	 * @param {String}  collectionKey  key of collection
	 * @param {Node}    node
	 * @param {Integer} mark
	 */
	setMark (collectionKey, node, mark) {
		const collection = collections[collectionKey];
		if (!collection) {
			throw new Error(`Could not find collection ${collectionKey}`);
		}
		if (collection.indexOf(node) === -1) {
			this.logger(3, 'Setting Mark ', collectionKey, 'on',  node, `#${mark}`);
			collection.push(node);
			collection.marks.push(mark);
		}
	}

	/**
	 * findFunction find the function definition from a call expression
	 * @param  {Node}   node    CallExpression node
	 * @return {Node|Boolean}
	 */
	findFunction (node) {
		if (node.type !== 'CallExpression') {
			throw new Error(`node must be of type CallExpression but got ${node.type}`);
		}

		const callee = node.callee;
		if (callee.type === 'Identifier') {
			const id = callee.name;

			let found = false,
				scope = this.context.getScope();

			while (scope && !found) {
				found = scope.variables.reduce((res, item) => {
					if (!res && item.name === id) {
						return item.references.reduce((res, ref) => {
							if (!res) {
								const def = ref.resolved && ref.resolved.defs && ref.resolved.defs[0];
								if (!def) {
									this.logger(3, 'Could not find def', ref);
									return res;
								}
								if (def.type === 'FunctionName') {
									return def.node;
								}
								if(def.type === 'Variable' && !def.node.init) { //TODO: see that we can find definition of variable containing functions
									this.logger(8, 'Error', def, def.node);
									return false;
								}
								if (def.type === 'Variable' && def.node.init.type.indexOf('FunctionExpression') >= 0) {
									return def.node.init;
								}
							}
							return res;
						}, false);
					}
					return res;
				}, false);

				scope = scope.upper;
			}
			return found;
		}

		const ref = this.findCallExpression(callee);
		if (ref && !ref.params) { //TODO: implement and test
			this.logger(8, 'Not Function Error', callee, ref);
			return null;
		}
		return ref;
	}

	/**
	 * findCallExpression find the function definition from expression
	 * @param  {Node}   node    Expression node
	 * @return {Node|Boolean}
	 */
	findCallExpression (node) {
		switch (node.type) {
			case 'Literal':
				return node;
			case 'MemberExpression':
				return this.findCallProperty(node.object, node.property);
			case 'Identifier':
				return this.findVariable(node);
			case 'CallExpression':
				return this.findFunction(node);
			case 'LogicalExpression':
				return {
					right: this.findCallExpression(node.right),
					left: this.findCallExpression(node.left)
				};
			case 'ArrayExpression': //TODO: Test
				return node.elements.map((child) => this.findCallExpression(child));
			case 'SequenceExpression': //TODO: Test
				if (node.expressions.length) {
					return this.findCallExpression(node.expressions[node.expressions.length - 1]);
				}
				return null;
			case 'ThisExpression': //TODO: Implement and test
				this.logger(8, 'Cannot Parse ThisExpression', node);
				return null;
			case 'FunctionExpression':
				return node;
			default:
				this.logger(8, `unknown object type ${node.type}`, node);
		}
	}

	/**
	 * findVariable find the variable of a specific identifier
	 * @param  {Node}   node    Identifier node
	 * @return {Node|Undefined}
	 */
	findVariable (node) {
		if (node.type !== 'Identifier') {
			this.logger(8, 'Node is note identifier',  node);
			throw new Error(`node must be of type Identifier but got ${node.type}`);
		}
		let scope = this.context.getScope();
		while (scope) {
			const variable = scope.variables.reduce((res, item) => {
				return res || (item.name ===  node.name && item);
			}, false);

			if (variable) {
				return variable;
			}

			scope = scope.upper;
		}
	}

	/**
	 * findCallProperty find the function definition from object property
	 * @param  {[type]} ObjectRef [description]
	 * @param  {[type]} property  [description]
	 * @return {[type]}           [description]
	 */
	findCallProperty (ObjectRef, property) {
		const declaration = this.findCallExpression(ObjectRef);
		if (declaration) {
			const def = this.getVariableDefinition(declaration);
			this.logger('Found def for', ObjectRef, property, def);
		} else {
			this.logger(4, 'Could not find def for', ObjectRef, property);
		}
	}

	/**
	 * getVariableDefinition from variable object
	 * @param  {Variable}   variable
	 * @return {Node|Undefined}
	 */
	getVariableDefinition (variable) {
		return variable && variable.defs && variable.defs[0];
	}

	/**
	 * markInsecureCall  finds all variables used to create an argument that was passed to an insecure function and mark them
	 * @param  {String}  key        injection key
	 * @param  {Integer} mark       argument mark index
	 * @param  {Node}    startNode  Node to look from
	 * @param  {Array}   seen       Nodes already marked by the run loop
	 */
	markInsecureCall (key, mark, startNode, seen = []) {
		this.traverseNode(startNode, node => {
			if (seen.indexOf(node) >= 0) {
				return;
			}

			seen.push(node);

			if (node.type === 'MemberExpression' || node.type === 'Identifier') {
				this.setMark(`${key}Injected`, node, mark);
				if (this.testViolation(node)) {
					return;
				}
				if (node.type === 'Identifier') {
					const variable = this.findVariable(node);
					if (variable) {
						const def = this.getVariableDefinition(variable);
						if (def) {
							if (def.type === 'Parameter') {
								const param = def.node.params[def.index];
								this.setMark(`${key}Injected`, param, mark);
								if (this.testViolation(param)) {
									return;
								}
							} else {
								this.logger(1, variable, 'is not a parameter', def.type, def);
							}
						} else {
							this.logger(7, 'Could not find def for', variable);
						}
						return variable.references.forEach(ref => {
							const idNode = ref.identifier;
							const parent = idNode && idNode.parent;
							if (parent.type === 'AssignmentExpression' && parent.left === idNode) {
								this.logger(6, 'Checking mark', parent.right, parent.left, parent);
								if (!this.getMark(`${key}Sanitized`, parent.right)) {
									return this.markInsecureCall(key, mark, parent.right, seen);
								} else {
									this.logger(6, 'Found sanitized call', parent, node);
									return null;
								}
							}
							if (parent.type === 'VariableDeclarator' && parent.id === idNode) {
								if (!this.getMark(`${key}Sanitized`, parent.init)) {
									return this.markInsecureCall(key, mark, parent.init, seen);
								} else {
									this.logger(4, 'Found sanitized call', parent, node);
									return null;
								}
							}
						});

					}

					return;
				}
			}
		});
	}

	/**
	 * create a visitor function that will copy param from internal node to parent node;
	 * @param  {String} property child node property on parent node
	 * @param  {String} collectionKey  key of collection
	 * @return {Function}        visitor function for parent node
	 */
	bubbleCollection (property, collectionKey) {
		return node => {
			const mark = this.getMark(collectionKey, node[property]);
			if (mark) {
				this.setMark(collectionKey, node, mark);
			} else {
				this.logger(2, 'No mark for ', property, node);
			}
		};
	}

	/**
	 * checkIdentifierInList check if identifier is contained within defenition list
	 * @param  {[type]} list [description]
	 * @param  {[type]} node   [description]
	 * @return {Boolean}
	 */
	checkIdentifierInList (list, node) {
		return list.reduce((isInput, input) => {
			if (isInput) {
				return isInput;
			}

			if (typeof input === 'string') {
				return input === node.name;
			}

			if (Array.isArray(input)) {
				let currNode = {parent:  node};
				return input.reduce((isInput, input) => {
					currNode = currNode.parent;
					if (!isInput || !currNode) {
						return false;
					}
					return this.checkIdentifierInList([input], currNode);
				}, true);
			}

			if (input instanceof RegExp) {
				return input.test(node.name);
			}

		}, false);
	}

	/**
	 * getAssignment
	 * @param  {[type]}  node [description]
	 * @return {Boolean}      [description]
	 */
	getAssignment (node) {
		if (node.parent.type === 'AssignmentExpression') {
			return node.parent.left === node && node.parent || null;
		}

		if (node.parent.type === 'MemberExpression') {
			return this.getAssignment(node.parent);
		}

		return null;
	}
}

module.exports = helpers;