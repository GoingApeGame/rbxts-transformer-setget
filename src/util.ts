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
	for (const child of node.getChildren()) {
		if (check(child)) {
			return child;
		}

		const result = getChildOfType(child, check);
		if (result) return result;
	}
	return undefined;
}

export function isChildOfNode(parent: ts.Node, node: ts.Node) {
	for (const child of parent.getChildren()) {
		if (child === node) return true;
		if (isChildOfNode(child, node)) return true;
	}
	return false;
}
