import ts from "typescript";
import { getNearestBinaryExpression } from "./util";

/**
 * This is the transformer's configuration, the values are passed from the tsconfig.
 */
export type TransformerConfig = {
	internalPrefix?: string;
};

const DEFAULT_PREFIX = "__";
const SETTER_POSTFIX = "_set";
const GETTER_POSTFIX = "_get";

/**
 * This is a utility object to pass around your dependencies.
 *
 * You can also use this object to store state, e.g prereqs.
 */
export class TransformContext {
	public factory: ts.NodeFactory;

	constructor(
		public program: ts.Program,
		public context: ts.TransformationContext,
		public config: TransformerConfig,
	) {
		this.factory = context.factory;
	}

	/**
	 * Transforms the children of the specified node.
	 */
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

	let getterDeclaration: ts.GetAccessorDeclaration | undefined;
	let setterDeclaration: ts.SetAccessorDeclaration | undefined;

	for (const declaration of nodeSymbol.declarations) {
		if (ts.isGetAccessorDeclaration(declaration)) {
			getterDeclaration = declaration;
		}

		if (ts.isSetAccessorDeclaration(declaration)) {
			setterDeclaration = declaration;
		}

		if (getterDeclaration && setterDeclaration) break;
	}

	const isGetterOrSetter =
		(getterDeclaration || setterDeclaration) !== undefined;
	if (!isGetterOrSetter) return context.transform(node);

	const binaryExpression = getNearestBinaryExpression(node);
	const isSetter =
		setterDeclaration !== undefined &&
		binaryExpression !== undefined &&
		binaryExpression.operatorToken.kind === ts.SyntaxKind.EqualsToken;

	if (!isSetter) {
		return factory.createCallChain(
			factory.updatePropertyAccessExpression(
				node,
				context.transform(node.expression),
				factory.createIdentifier(
					`${config.internalPrefix ?? DEFAULT_PREFIX}${GETTER_POSTFIX}${node.name.getText()}`,
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
			`${config.internalPrefix ?? DEFAULT_PREFIX}${SETTER_POSTFIX}${node.name.getText()}`,
		),
	);
}

function visitBinaryExpression(
	context: TransformContext,
	node: ts.BinaryExpression,
) {
	const { factory, program } = context;
	const typeChecker = program.getTypeChecker();

	const nodeSymbol = typeChecker.getSymbolAtLocation(node.left);
	if (!nodeSymbol || !nodeSymbol.declarations) return context.transform(node);

	let getterDeclaration: ts.GetAccessorDeclaration | undefined;
	let setterDeclaration: ts.SetAccessorDeclaration | undefined;

	for (const declaration of nodeSymbol.declarations) {
		if (ts.isGetAccessorDeclaration(declaration)) {
			getterDeclaration = declaration;
		}

		if (ts.isSetAccessorDeclaration(declaration)) {
			setterDeclaration = declaration;
		}

		if (getterDeclaration && setterDeclaration) break;
	}

	const isGetterOrSetter =
		(getterDeclaration || setterDeclaration) !== undefined;
	if (!isGetterOrSetter) return context.transform(node);

	const isSetter =
		setterDeclaration !== undefined &&
		node &&
		node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
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
	return factory.createMethodDeclaration(
		node.modifiers,
		undefined,
		factory.createIdentifier(
			`${config.internalPrefix ?? DEFAULT_PREFIX}${SETTER_POSTFIX}${node.name.getText()}`,
		),
		undefined,
		undefined,
		node.parameters,
		undefined,
		node.body,
	);
}

function visitGetAccessor(
	context: TransformContext,
	node: ts.GetAccessorDeclaration,
) {
	const { factory, config } = context;
	return factory.createMethodDeclaration(
		node.modifiers,
		undefined,
		factory.createIdentifier(
			`${config.internalPrefix ?? DEFAULT_PREFIX}${GETTER_POSTFIX}${node.name.getText()}`,
		),
		undefined,
		undefined,
		[],
		undefined,
		node.body,
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

	if (ts.isBinaryExpression(node)) {
		return visitBinaryExpression(context, node);
	}

	return context.transform(node);
}
