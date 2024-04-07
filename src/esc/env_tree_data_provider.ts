import * as vscode from 'vscode';
import EscApi from './api';
import * as cli from './cli';
import { formEnvUri } from './environmentUri';


export function trackEnvironmentEditorSelection(escTreeProvider: EnvironmentsTreeDataProvider, treeView: vscode.TreeView<any>): (e: vscode.TextEditor | undefined) => any {
    return (editor) => {
        if (editor?.document.uri.scheme === "pulumi") {
            const element = escTreeProvider.getTreeItemByUri(editor.document.uri);
            if (element) {
                treeView.reveal(element, { select: true, focus: true });
            }
        }
    };
}

export function onOpenLanguageSelector(): (e: vscode.TextDocument) => any {
    return async (document) => {
        if (document.uri.scheme === "pulumi" && document.languageId !== "yaml") {
            if (document.uri.path.endsWith("json")) {
                await vscode.languages.setTextDocumentLanguage(document, "yaml");
                return;
            }
            if (document.uri.path.endsWith("dotenv") || document.uri.path.endsWith("shell")) {
                await vscode.languages.setTextDocumentLanguage(document, "shell");
                return;
            }
            await vscode.languages.setTextDocumentLanguage(document, "yaml");
        }
    };
}
  
 
export class EnvironmentsTreeDataProvider implements vscode.TreeDataProvider<Environment> {
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
    private data = new Map<string, Environment>();

    constructor(context: vscode.ExtensionContext) {
        vscode.commands.registerCommand("pulumi.esc.refresh", () => {
            this._onDidChangeTreeData.fire(undefined);
          });
    }

    getTreeItem(element: Environment): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: Environment): Promise<Environment[]> {
        if (element) {
            return [];
        }

        const org = await cli.organization();
        const api = new EscApi(org);

        const environments = await api.listAllEnvironments();
        const envItems = environments.map(env => new Environment(org, env.name, vscode.TreeItemCollapsibleState.None));
        envItems.forEach(element => {
            if (element.resourceUri) {
                this.data.set(element.resourceUri.toString(), element);
            }
        });

        envItems.sort((a, b) => a.envName.localeCompare(b.envName));

        return envItems;
    }

    async getParent(element: Environment): Promise<Environment | undefined> {
        return undefined;
    }

    public getTreeItemByUri(uri: vscode.Uri): Environment | undefined {
        return this.data.get(uri.toString());
    }
}


export class Environment extends vscode.TreeItem {
    constructor(
        public readonly org: string,
        public readonly envName: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(envName, collapsibleState);
        this.label = envName;
        this.iconPath = new vscode.ThemeIcon('symbol-keyword');
        const uri = formEnvUri(org, envName);
        this.id = `env-${org}-${envName}`;
        this.resourceUri = uri;
        this.contextValue = 'environment';
        this.command = {
            command: 'vscode.open',
            title: 'Edit Environment',
            arguments: [uri],
        };
    }
}