import * as vscode from 'vscode';
import { formEnvUriFromImportRef } from '../uriHelper';
import * as esc from '../models';

export function findExprAtPosition(doc: vscode.TextDocument, org: string, expr: esc.PropertyAccessor, position: vscode.Position): vscode.Location | undefined {
	const range = rangeFromEscRange(expr.range);
	if (range.contains(position)) {
		return locationFromValueRange(doc, expr.value, org);
	}

	return undefined;
}

export function locationFromValueRange(doc: vscode.TextDocument, value: esc.Range, org: string) {
	let uri = doc.uri;
	if (value.environment !== "<yaml>") {
		uri = formEnvUriFromImportRef(org, value.environment);
	}
	return new vscode.Location(uri, rangeFromEscRange(value));
}

function positionFromEscPosition(position: esc.Position): vscode.Position {
	return new vscode.Position(position.line-1, position.column-1);
}

export function rangeFromEscRange(range: esc.Range): vscode.Range {
	return new vscode.Range(
		positionFromEscPosition(range.begin),
		positionFromEscPosition(range.end),
	);
}