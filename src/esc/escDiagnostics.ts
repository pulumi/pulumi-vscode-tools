import * as vscode from 'vscode';
import { isPulumiEscEditor, isPulumiEscDocument } from './editorHelper';
import EscApi from './api';
import { parseEnvUri } from './uriHelper';
import * as yaml from "js-yaml";


export class EscDiagnostics {

    private timeout = false;
    constructor(private api: EscApi) {}

    public subscribeToDocumentChanges(ctx: vscode.ExtensionContext): void {

        const diagnostics = vscode.languages.createDiagnosticCollection('esc');
        ctx.subscriptions.push(diagnostics);

        const editor = vscode.window.activeTextEditor;
        if (isPulumiEscEditor(editor)) {
            this.debouncedRefresh(editor!.document, diagnostics);
        }

        ctx.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(async editor => {
                if (isPulumiEscEditor(editor)) {
                    this.debouncedRefresh(editor!.document, diagnostics);
                }
            })
        );

        ctx.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(async e => {
                if (isPulumiEscDocument(e.document)) {
                    this.debouncedRefresh(e.document, diagnostics);
                }
            })
        );

        ctx.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument(doc => {
                if (isPulumiEscDocument(doc)) {
                    diagnostics.delete(doc.uri);
                }
            })
        );

    }

    debouncedRefresh(doc: vscode.TextDocument, diagCollection: vscode.DiagnosticCollection) {
        if (this.timeout) {
            return;
        }

        setTimeout(async () => await this.refreshDiagnostics(doc, diagCollection), 1000);
    }

    async refreshDiagnostics(doc: vscode.TextDocument, diagCollection: vscode.DiagnosticCollection): Promise<void> {
        this.timeout = false;
        const { org } = parseEnvUri(doc.uri);
        const definiton =  doc.getText();
        try {
            yaml.load(definiton);
        } catch (err: any) {
            return;
        }
        const { diagnostics } = await this.api.checkEnvironment(org, definiton);

        
        if (!diagnostics) {
            diagCollection.clear();
            return;
        }

        const vsDiagnostics = diagnostics.map(diag => {
            const range = new vscode.Range(
                new vscode.Position(fixRangePart(diag.range?.begin.line), fixRangePart(diag.range?.begin.column)),
                new vscode.Position(fixRangePart(diag.range?.end.line), fixRangePart(diag.range?.end.column)));

            return new vscode.Diagnostic(range, diag.summary, vscode.DiagnosticSeverity.Error);
        });

        diagCollection.set(doc.uri, vsDiagnostics);
    }


}

function fixRangePart(part: number | undefined): number {
    if (!part || part === 0) {
        return 0;
    }

    return part - 1;
}