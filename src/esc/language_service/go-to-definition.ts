import * as esc from "../models";

import { exprAtPath } from "./environment";
import * as yaml from "./yaml-document";
import * as vscode from 'vscode';
import { formEnvUriFromImportRef, parseEnvUri } from "../uriHelper";


export function provideDefinitionLocation(
	doc: vscode.TextDocument,
	docYaml: yaml.Document | undefined,
    exprs: Record<string, esc.Expr> | undefined,
	properties: Record<string, esc.Value> | undefined,
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

	const at = exprAtPath(exprs, pathAccessors);
	if (at !== undefined) {
		const { expr, builtin, argPath } = at;
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
				const location =  findExprAtPosition(doc, org, subExpr, position);
				if (location !== undefined) {
					return location;
				}
			}
		}
	}

	return undefined;
}

function findExprAtPosition(doc: vscode.TextDocument, org: string, expr: esc.PropertyAccessor, position: vscode.Position): vscode.Location | undefined {
	const range = rangeFromEscRange(expr.range);
	if (range.contains(position)) {
		return locationFromValueRange(doc, expr.value, org);
	}

	return undefined;
}

function locationFromValueRange(doc: vscode.TextDocument, value: esc.Range, org: string) {
	let uri = doc.uri;
	if (value.environment !== "<yaml>") {
		uri = formEnvUriFromImportRef(org, value.environment);
	}
	return new vscode.Location(uri, rangeFromEscRange(value));
}

function positionFromEscPosition(position: esc.Position): vscode.Position {
	return new vscode.Position(position.line-1, position.column-1);
}

function rangeFromEscRange(range: esc.Range): vscode.Range {
	return new vscode.Range(
		positionFromEscPosition(range.begin),
		positionFromEscPosition(range.end),
	);
}

function escRangeToYamlRange(document: vscode.TextDocument, range: esc.Range): yaml.Range {
	return { 
		start: document.offsetAt(positionFromEscPosition(range.begin)), 
			 end: document.offsetAt(positionFromEscPosition(range.end))
	};
}