import ts from "typescript";
import {
	getAncestorOfType,
	getChildOfType,
	getGetterSetterDeclarations,
	isChildOfNode,
} from "./util";

export type TransformerConfig = {
	customPrefix?: string;
};

const DEFAULT_PREFIX = "__";
const SETTER_PREFIX = "set";
const GETTER_PREFIX = "get";

export class TransformContext {
	public factory: ts.NodeFactory;

	constructor(
		public program: ts.Program,
		public context: ts.TransformationContext,
		public config: TransformerConfig,
	) {
		this.factory = context.factory;
	}

	transform<T extends ts.Node>(node: T): T {
		return ts.visitEachChild(
			node,
			(node) => visitNode(this, node),
			this.context,
		);
	}
}

function visitPropertyAccessExpression(
	context: TransformContext,
	node: ts.PropertyAccessExpression,
) {
	const { factory, program, config } = context;
	const typeChecker = program.getTypeChecker();

	const nodeSymbol = typeChecker.getSymbolAtLocation(node);
	if (!nodeSymbol || !nodeSymbol.declarations) return context.transform(node);

	const [getterDeclaration, setterDeclaration] =
		getGetterSetterDeclarations(nodeSymbol);
	const isGetterOrSetter =
		(getterDeclaration || setterDeclaration) !== undefined;
	if (!isGetterOrSetter) return context.transform(node);

	const assignmentExpression = getAncestorOfType(
		node,
		ts.isAssignmentExpression,
	);
	const isSetter =
		setterDeclaration !== undefined &&
		assignmentExpression !== undefined &&
		(node === assignmentExpression.left ||
			isChildOfNode(assignmentExpression.left, node));

	if (!isSetter) {
		return factory.createCallChain(
			factory.updatePropertyAccessExpression(
				node,
				context.transform(node.expression),
				factory.createIdentifier(
					`${config.customPrefix ?? DEFAULT_PREFIX}${GETTER_PREFIX}${node.name.getText()}`,
				),
			),
			node.questionDotToken,
			[],
			[],
		);
	}

	return factory.updatePropertyAccessExpression(
		node,
		context.transform(node.expression),
		factory.createIdentifier(
			`${config.customPrefix ?? DEFAULT_PREFIX}${SETTER_PREFIX}${node.name.getText()}`,
		),
	);
}

function visitAssignmentExpression(
	context: TransformContext,
	node: ts.BinaryExpression,
) {
	const { factory, program } = context;
	const typeChecker = program.getTypeChecker();

	const propertyAccessExpression = getChildOfType(
		node,
		ts.isPropertyAccessExpression,
	);
	if (!propertyAccessExpression) return context.transform(node);

	const nodeSymbol = typeChecker.getSymbolAtLocation(propertyAccessExpression);
	if (!nodeSymbol) return context.transform(node);

	const [_, setterDeclaration] = getGetterSetterDeclarations(nodeSymbol);

	const isSetter = setterDeclaration !== undefined;
	if (!isSetter) return context.transform(node);

	return context.transform(
		factory.createCallExpression(node.left, undefined, [node.right]),
	);
}

function visitSetAccessor(
	context: TransformContext,
	node: ts.SetAccessorDeclaration,
) {
	const { factory, config } = context;
	return context.transform(
		factory.createMethodDeclaration(
			node.modifiers,
			undefined,
			factory.createIdentifier(
				`${config.customPrefix ?? DEFAULT_PREFIX}${SETTER_PREFIX}${node.name.getText()}`,
			),
			undefined,
			undefined,
			node.parameters,
			undefined,
			node.body,
		),
	);
}

function visitGetAccessor(
	context: TransformContext,
	node: ts.GetAccessorDeclaration,
) {
	const { factory, config } = context;
	return context.transform(
		factory.createMethodDeclaration(
			node.modifiers,
			undefined,
			factory.createIdentifier(
				`${config.customPrefix ?? DEFAULT_PREFIX}${GETTER_PREFIX}${node.name.getText()}`,
			),
			undefined,
			undefined,
			[],
			undefined,
			node.body,
		),
	);
}

function visitNode(
	context: TransformContext,
	node: ts.Node,
): ts.Node | ts.Node[] {
	if (ts.isGetAccessor(node)) {
		return visitGetAccessor(context, node);
	}

	if (ts.isPropertyAccessExpression(node)) {
		return visitPropertyAccessExpression(context, node);
	}

	if (ts.isSetAccessor(node)) {
		return visitSetAccessor(context, node);
	}

	if (ts.isAssignmentExpression(node)) {
		return visitAssignmentExpression(context, node);
	}

	return context.transform(node);
}
