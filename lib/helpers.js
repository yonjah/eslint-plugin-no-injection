/**
 * @fileoverview ESLint helpers to analyze and find nodes on tree
 * @author Yoni Jah.
 */
'use strict';

const colors = require('colors/safe');
const ignoreKeys = ['parent'];


const nodes = [{}];
const DEBUG = process.env.DEBUG || global.DEBUG || Infinity;
const DEBUG_STACK = process.env.DEBUG_STACK && process.env.DEBUG_STACK.split(',') || [Infinity];
const fgColor = [ null, 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'gray', 'white'];
const bgColor = ['bgBlack', 'bgRed', 'bgGreen', 'bgYellow', 'bgBlue', 'bgMagenta', 'bgCyan', null];

const colorPairs = [];

bgColor.forEach((bg, t) => {
	fgColor.forEach((fg, i) => {
		if (i !== t) {
			return colorPairs.push([fg, bg]);
		}
	});
});

class helpers {
	constructor (args) {
		const collections = {
			htmlSanitized: [],
			htmlInjected: [],
			unsanitizedInput: []
		};

		Object.keys(collections).forEach(key => {
			collections[key].marks = [];
		});

		if (!args.context) {
			throw new Error('Missing context');
		}
		if (!args.settings) {
			throw new Error('Missing settings');
		}
		this.context = args.context;
		this.settings = args.settings;
		this.sourceCode = this.context.getSourceCode();
		this.collections = collections;
	}

	logId (collectionID, id, msg) {
		// const id = ((node.loc.start.line * 1000) + node.loc.start.column) * 100000 + (node.loc.end.line * 1000) + node.loc.end.column;
		const color = colorPairs[(collectionID * 7 + id) % colorPairs.length];

		msg = msg || ` ${collectionID}-${id} `;
		if (color[0] && color[1]) {
			return colors.bold[color[0]][color[1]](msg);
		}
		if (color[0]) {
			return colors.bold[color[0]](msg);
		}
		if (color[1]) {
			return colors.bold[color[1]](msg);
		}
		return colors.bold(msg);
	}

	logMarkers () {
		let final  = '',
			offset = 0;

		const lastEnd = [];

		const source = this.context.getSource();
		const nodes  = Object.keys(this.collections).reduce((nodes, coll) => {
			return nodes.concat(this.collections[coll]);
		}, []).sort((a,b) => {
			if (a.start > b.start) {
				return 1;
			}
			if (b.start > a.start) {
				return -1;
			}
			if (a.end > b.end) {
				return -1;
			}
			return 1;
		});



		nodes.forEach((node, i) => {
			if (node.body) {
				return;
			}
			let color = colors.underline.red,
				last;

			if (this.collections.htmlInjected.indexOf(node) >= 0) {
				color = colors.magenta;
			} else if (this.collections.htmlSanitized.indexOf(node) >= 0) {
				color = colors.green;
			}


			last = lastEnd.pop();
			while (last) {
				if (node.start > last[0]) {
					final += last[1](source.substring(offset, last[0]));
					offset = last[0];
					last = lastEnd.pop();
				} else {
					lastEnd.push(last);
					last = null;
				}
			}
			if (offset < node.start) {
				final += source.substring(offset, node.start);
				offset = node.start;
			}

			const next = nodes[i + 1];
			let end = node.end;
			if (next && end > next.start) {
				lastEnd.push([end, color]);
				end = next.start;
			}

			if (offset < end) {
				final += color(source.substring(offset, end));
				offset = end;
			}


		});
		if (lastEnd.length) {
			let last = lastEnd.pop();
			while (last && offset !== source.length) {
				final += last[1](source.substring(offset, last[0]));
				offset = last[0];
				last = lastEnd.pop();
			}
		}
		if (offset !== source.length) {
			final += source.substring(offset);
		}
		console.log(final);
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
						return `${arg.type} ${this.getCode(arg)} (${arg.loc.start.line}:${arg.loc.start.column})`;
					} catch (e) {
						console.log(arg); // eslint-disable-line no-console
						console.log(`${this.getCode(arg.parent)} Child Error ${arg.type}`); // eslint-disable-line no-console
						throw e;
					}
				}
				return arg && arg.name || arg;
			}));
			if (level >= DEBUG_STACK[0]) {
				const stack = new Error().stack.split('\n    at ');
				stack.splice(0, 2);
				console.log('\t', stack.splice(0, 2).join('\n\t')); // eslint-disable-line no-console
				if (level === DEBUG_STACK[1]) {
					const ruleStack = stack.filter(line => line.indexOf('eslint-test/lib/rules/') >= 0);
					ruleStack.length && console.log('\t', ruleStack.join('\n\t')); // eslint-disable-line no-console
				}
				if (level > DEBUG_STACK[1]) {
					stack.length && console.log('\t', stack.join('\n\t')); // eslint-disable-line no-console
				}

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

	markIdentifier (node, index, key) {
		key = key || 'unsanitizedInput';
		index = index === undefined ? this.getNodeIndex(node) : index;
		this.setMark(key, node, index);
		let parent = node.parent;

		while (parent) {
			this.setMark(key, parent, index);
			if (parent.type === 'VariableDeclarator') {
				this.markVariableDeclarator(parent, key);
			} else if (parent.type === 'CallExpression') {
				if (key === 'unsanitizedInput') {
					this.markCallExpression(parent, key);
					this.testCallExpression(parent, key);
				} else {
					this.logger(3, 'Ignoring call Expression', parent);
				}
			} else if (parent.type === 'AssignmentExpression' && parent.right === node) {
				this.markExpression(parent, key);
				return;
			} else if (parent.type.indexOf('Expression') >= 0) {
				this.logger('Unknown Expression', parent);
			} else if (parent.type.indexOf('FunctionDeclaration') >= 0) {
				this.markFunctionDecleration(parent);
			}
			node = parent;
			parent = node.parent;
		}
	}

	testCallExpression (node) {
		let callee;

		const mark = this.getMark('unsanitizedInput', node);

		if (node.callee.type === 'Identifier') {
			callee = node.callee;
		} else if (node.callee.type === 'MemberExpression') {
			callee = node.callee.property;
		}

		if (callee) {
			Object.keys(this.settings.injections).forEach(key => {
				const injection = this.settings.injections[key];
				if (injection.valnurable.methods && this.checkIdentifierInList(injection.valnurable.methods, callee)) {
					this.setMark(`${key}Injected`, node, this.getNodeIndex(node));
					if (mark) {
						if (!this.getMark(`${key}Sanitized`, node)) {
							this.context.report({
								node,
								message: 'Used with unsanitized input'
							});

							this.context.report({
								node: nodes[mark],
								message: `Inserted unsanitized as ${key}`
							});
						}
					}


				}

				if (injection.sanitizers && this.checkIdentifierInList(injection.sanitizers, callee)) {
					const index = this.getNodeIndex(node);
					const colKey = `${key}Sanitized`;
					const parent = node.parent;

					this.setMark(colKey, node, index);
					if (parent.type.indexOf('Expression') >= 0) {
						this.setMark(colKey, parent, index);
						this.markExpression(parent, colKey);
					}
				}
			});
		} else {
			this.logger(8, 'Could not find callee', node);
		}
	}

	markVariableDeclarator (node, key) {
		key = key || 'unsanitizedInput';
		const mark = this.getMark(key, node);
		if (mark) {
			let active = false,
				parent = node.parent;
			const id = node.id;

			while (parent && !parent.body) {
				parent = parent.parent;
			}

			if (parent) {
				return this.walkNode(parent.body, (child) => {
					if (active) {
						if (child.type === 'Identifier' && id.name === child.name && child.parent.type !== 'MemberExpression' && !this.getMark(key, child)) {
							this.markIdentifier(child, mark, key);
						}
					} else if (node === child) {
						active = true;
					}
				});
			}
		}
	}

	markFunctionDecleration  (node, key) {
		key = key || 'unsanitizedInput';
		const mark = this.getMark(key, node);
		if (mark) {
			let parent = node.parent;

			while (parent && !parent.body) {
				parent = parent.parent;
			}

			if (parent) {
				return this.walkNode(parent.body, (child) => {
					if (child.type === 'CallExpression' && child.callee.type === node.id.type &&
							(node.id.type === 'Identifier' && child.callee.name === node.id.name) ||
							(node.id.type === 'MemberExpression' && child.callee.property.name === node.id.property.name)
					) {
						this.markIdentifier(child, mark, key);
					}
				});
			}
		}
	}

	markExpression (node, key) {
		key = key || 'unsanitizedInput';
		const mark = this.getMark(key, node.right);
		if (mark) {
			let active = false,
				parent = node.parent;
			const left = node.left;
			this.setMark(key, left, mark);
			while (parent && !parent.body) {
				parent = parent.parent;
			}
			if (parent && left.type === 'Identifier') {
				return this.walkNode(parent.body, (node) => {
					if (active) {
						if (node.type === 'Identifier' && node.name === left.name && !this.getMark(key, node)) {
							this.markIdentifier(node, mark, key);
						}
					} else if (node === left) {
						active = true;
					}
				});
			}

			if (left.type === 'MemberExpression') {
			}
		}
	}

	markCallExpression (node)  {
		const marks = [];
		const insecureArgs = [];

		this.logger('Checking if unsanitizedInput is used as call args', node);
		node.arguments.forEach((arg, i) => {
			this.logger(2, 'testing argument', arg);
			const mark = this.getMark('unsanitizedInput', arg);
			if (mark) {
				insecureArgs.push(i);
				marks.push(mark);
			}
		});

		if (!insecureArgs.length) {
			this.logger('no unsanitizedInput args',  node);
			return;
		}

		this.logger('found unsanitizedInput args', insecureArgs.join(','),  node);
		this.setMark('unsanitizedInput', node, marks[0]); //we can only set a single mark, might need to revisit this for better report

		const funcNode = this.findFunction(node);

		if (funcNode) {
			this.logger(2, 'Found function defenition', funcNode);
			insecureArgs.forEach((i) => {
				const arg = node.arguments[i];
				const param = funcNode.params[i];
				const name = param.name;
				this.logger(2, 'moving into argument param', param);
				debugger;
				this.walkNode(funcNode.body, (node) => {
					if (node.type === 'Identifier' && node.name === name) {
						this.setMark('unsanitizedInput', node, marks[i]);
					}
				});
			});
		} else  {
			this.logger(2, 'Could not find function definition for call', node);
		}
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
		const collection = this.collections[collectionKey];
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
		const collection   = this.collections[collectionKey];
		const collectionID = Object.keys(this.collections).indexOf(collectionKey) + 1;
		if (!collection) {
			throw new Error(`Could not find collection ${collectionKey}`);
		}

		if (collection.indexOf(node) === -1) {
			this.logger(10, this.logId(collectionID, mark), 'Setting Mark ', collectionKey, 'on',  node, `#${mark}`);
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
				// this.setMark(`${key}Injected`, node, mark);
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
								// this.setMark(`${key}Injected`, param, mark);
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