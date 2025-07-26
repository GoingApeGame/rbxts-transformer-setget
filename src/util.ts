import chalk from "chalk";
import ts from "typescript";

type TupleToUnion<T extends unknown[]> = T[number];
type NodeValidators<T> = { [K in keyof T]: (node: any) => node is T[K] };

export function isTuple<T extends ts.Node[] | []>(
	node: ts.Node,
	...args: NodeValidators<T>
): node is TupleToUnion<T> {
	for (const validator of args) {
		if (validator(node)) return true;
	}
	return false;
}

export function getAncestorOfType<T extends ts.Node>(
	node: ts.Node,
	check: (node: ts.Node) => node is T,
): T | undefined {
	let currentNode: ts.Node = node;
	while (currentNode.parent) {
		const parent = currentNode.parent;
		if (check(parent)) {
			return parent;
		}
		if (
			isTuple(parent, ts.isAsExpression, ts.isParenthesizedExpression) &&
			parent.expression === currentNode
		) {
			currentNode = parent;
			continue;
		}
		break;
	}
	return undefined;
}

export function getChildOfType<T extends ts.Node>(
	node: ts.Node,
	check: (node: ts.Node) => node is T,
): T | undefined {
	let foundChild: T | undefined = undefined;
	node.forEachChild((child) => {
		if (foundChild) return;
		foundChild =
			check(child) !== false ? (child as T) : getChildOfType(child, check);
	});
	return foundChild;
}

export function writeLine(...messages: unknown[]) {
	for (const message of messages) {
		const text =
			typeof message === "string"
				? `${message}`
				: `${JSON.stringify(message, undefined, "\t")}`;

		const prefix = `[${chalk.gray("rbxts-transformer-setget")}]: `;
		process.stdout.write(`${prefix}${text.replace(/\n/g, `\n${prefix}`)}\n`);
	}
}

export function getDescendantsOfType<T extends ts.Node>(
	node: ts.Node,
	check: (node: ts.Node) => node is T,
): T[] {
	const children: T[] = [];

	node.forEachChild((child) => {
		if (check(child)) children.push(child);
		children.push(...getDescendantsOfType(child, check));
	});

	return children;
}

export function isChildOfNode(parent: ts.Node, node: ts.Node) {
	let result = false;

	parent.forEachChild((child) => {
		if (result) return;
		result = child === node || isChildOfNode(child, node);
	});
	return result;
}

export function isFromInterface(
	getter?: ts.Declaration,
	setter?: ts.Declaration,
	program?: ts.Program,
): boolean {
	if (!program) return false;
	const typeChecker = program.getTypeChecker();

	const check = (decl?: ts.Declaration) => {
		if (!decl || !ts.isInterfaceDeclaration(decl.parent)) return false;

		const type = typeChecker.getTypeAtLocation(decl.parent);
		return doesTypeExtendInstance(typeChecker, type);
	};

	return check(getter) || check(setter);
}

function doesTypeExtendInstance(typeChecker: ts.TypeChecker, type: ts.Type): boolean {
	const symbol = type.getSymbol();
	if (!symbol) return false;

	const name = symbol.getName();
	if (name === "Instance") return true;

	for (const base of type.getBaseTypes() ?? []) {
		if (doesTypeExtendInstance(typeChecker, base)) {
			return true;
		}
	}

	return false;
}


export function getGetterSetterDeclarations(
	program: ts.Program,
	node: ts.PropertyAccessExpression,
) {
	const typeChecker = program.getTypeChecker();
	const nodeSymbol = typeChecker.getSymbolAtLocation(node.name);
	if (!nodeSymbol) return [undefined, undefined];

	let getterDeclaration: ts.Declaration | undefined;
	let setterDeclaration: ts.Declaration | undefined;

	if (nodeSymbol.declarations) {
		for (const declaration of nodeSymbol.declarations) {
			// Use parent check to avoid interface members
			if (
				ts.isGetAccessorDeclaration(declaration) &&
				ts.isClassLike(declaration.parent)
			) {
				getterDeclaration = declaration;
			}
			if (
				ts.isSetAccessorDeclaration(declaration) &&
				ts.isClassLike(declaration.parent)
			) {
				setterDeclaration = declaration;
			}
		}
	}

	// 🧠 Fallback: Use type to infer if it's a getter/setter even if not declared directly
	const parentType = typeChecker.getTypeAtLocation(node.expression);
	const property = parentType.getProperty(node.name.text);
	if (property) {
		const getter = property.getDeclarations()?.find((decl) => ts.isGetAccessorDeclaration(decl));
		const setter = property.getDeclarations()?.find((decl) => ts.isSetAccessorDeclaration(decl));
		getterDeclaration ??= getter;
		setterDeclaration ??= setter;
	}

	return [getterDeclaration, setterDeclaration];
}

