import * as esc from "../models";

import { exprAtPath } from "./environment";
import * as yaml from "./yaml-document";
import * as vscode from 'vscode';
import { formEnvUriFromImportRef, parseEnvUri } from "../uriHelper";
import { findExprAtPosition } from "./range_helper";


export function provideDefinitionLocation(
	doc: vscode.TextDocument,
	docYaml: yaml.Document | undefined,
    exprs: Record<string, esc.Expr> | undefined,
	position: vscode.Position,
): vscode.Location | undefined {
	const offset = doc.offsetAt(position);
	const yamlNode = yaml.findInDocument(docYaml, offset);
	if (yamlNode === undefined) {
		return undefined;
	}

	const { node, path } = yamlNode;
	if (node === undefined) {
		return undefined;
	}

	const org = parseEnvUri(doc.uri).org;
	const pathAccessors = yaml.pathAccessors(path);
	if (pathAccessors[0] === "imports" && node.type === "scalar") {
		const importRef = node.source;
		const uri = formEnvUriFromImportRef(org, importRef);
		return new vscode.Location(uri, new vscode.Position(0, 0));
	}

	return provideDefinition(doc, exprs, org, pathAccessors, position);
}

export function provideDefinition(
	doc: vscode.TextDocument,
	exprs: Record<string, esc.Expr> | undefined,
	org: string,
	pathAccessors: yaml.Accessor[],
	position: vscode.Position,
): vscode.Location | undefined {
	const at = exprAtPath(exprs, pathAccessors);
	if (at === undefined) {
		return undefined;
	}

	const { expr } = at;
	if (esc.isInterpolate(expr)) {
		for (const interpolation of expr.interpolate) {
			for (const subExpr of interpolation.value) {
				const location = findExprAtPosition(doc, org, subExpr, position);
				if (location !== undefined) {
					return location;
				}
			}
		}
	}

	if (esc.isSymbol(expr)) {
		for (const subExpr of expr.symbol) {
			const location = findExprAtPosition(doc, org, subExpr, position);
			if (location !== undefined) {
				return location;
			}
		}
	}

	return undefined;
}