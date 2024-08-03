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
		foundChild = check(child) !== false ? child as T : getChildOfType(child, check);
	});
	return foundChild;
}

export function isChildOfNode(parent: ts.Node, node: ts.Node) {
	let result = false;

	parent.forEachChild((child) => {
		if (result) return;
		result = child === node || isChildOfNode(child, node);
	});
	return result;
}

export function getGetterSetterDeclarations(program: ts.Program, node: ts.PropertyAccessExpression) {
	const typeChecker = program.getTypeChecker();
	const nodeSymbol = typeChecker.getSymbolAtLocation(node);
	if (!nodeSymbol) return [undefined, undefined];

	let getterDeclaration: ts.GetAccessorDeclaration | undefined;
	let setterDeclaration: ts.SetAccessorDeclaration | undefined;
	if (!nodeSymbol.declarations) return [undefined, undefined];

	for (const declaration of nodeSymbol.declarations) {
		if (ts.isGetAccessorDeclaration(declaration)) {
			getterDeclaration = declaration;
		}

		if (ts.isSetAccessorDeclaration(declaration)) {
			setterDeclaration = declaration;
		}

		if (getterDeclaration && setterDeclaration) break;
	}

	return [getterDeclaration, setterDeclaration];
}
