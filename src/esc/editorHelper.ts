

import * as vscode from 'vscode';
import { isPulumiUri } from './uriHelper';

export function isPulumiEscEditor(editor: vscode.TextEditor | undefined): boolean {
    return isPulumiEscDocument(editor?.document);
} 

export function isPulumiEscDocument(doc: vscode.TextDocument | undefined): boolean {
    return isPulumiUri(doc?.uri);
} 
