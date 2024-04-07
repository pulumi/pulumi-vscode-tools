import * as vscode from 'vscode';
import EscApi from './api';
import * as cli from './cli';
import { formEnvUri, parseEnvUri } from './environmentUri';


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
                await vscode.languages.setTextDocumentLanguage(document, "json");
                return;
            }
            if (document.uri.path.endsWith("dotenv") || document.uri.path.endsWith("shell")) {
                await vscode.languages.setTextDocumentLanguage(document, "shellscript");
                return;
            }
            await vscode.languages.setTextDocumentLanguage(document, "yaml");
        }
    };
}
  
 
export class EnvironmentsTreeDataProvider implements vscode.TreeDataProvider<Environment | Revision> {
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
    private data = new Map<string, Environment>();

    constructor(context: vscode.ExtensionContext) {
        vscode.commands.registerCommand("pulumi.esc.refresh", () => {
            this._onDidChangeTreeData.fire(undefined);
          });
    }

    getTreeItem(element: Environment | Revision): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: Environment | Revision): Promise<Environment[]> {
        if (element && element instanceof Environment) {
            return await this.getRevisions(element);
        }

        return await this.getEnvironments();
    }

    private async getRevisions(element: Environment) {
        const { org, envName } = parseEnvUri(element.resourceUri!);
        const api = new EscApi(org);

        const [revisions, tags] = await Promise.all([api.listRevisions(envName), api.listTags(envName)]);

        const revTagMap = new Map<number, string[]>();
        tags.forEach((tag) => {
            const tags = revTagMap[tag.revision] || [];
            tags.push(tag.name);
            revTagMap[tag.revision] = tags;
        });
        const revItems = revisions.map(rev => new Revision(org, envName, rev.number, element, revTagMap[rev.number] || [], vscode.TreeItemCollapsibleState.None));
        revItems.forEach(item => this.mapResourceUris(item));

        return revItems;
    }

    private async getEnvironments() {
        const org = await cli.organization();
        const api = new EscApi(org);

        const environments = await api.listAllEnvironments();
        const envItems = environments.map(env => new Environment(org, env.name, vscode.TreeItemCollapsibleState.Collapsed));
        envItems.forEach(item => this.mapResourceUris(item));

        envItems.sort((a, b) => a.envName.localeCompare(b.envName));

        return envItems;
    }

    private mapResourceUris(element: Environment) {
        if (element.resourceUri) {
            this.data.set(element.resourceUri.toString(), element);
        }
    }

    async getParent(element: Environment | Revision): Promise<Environment | undefined> {
        if (element instanceof Revision) {
            return element.parent;
        }

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

export class Revision extends vscode.TreeItem {
    constructor(
        public readonly org: string,
        public readonly envName: string,
        public readonly revision: number,
        public readonly parent: Environment,
        public readonly tags: string[],
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(envName, collapsibleState);
        this.label = revision.toString();
        this.description = this.tags.join(",");
        const base = formEnvUri(org, envName);
        const uri = vscode.Uri.joinPath(base, "revision", revision.toString());
        this.id = `env-${org}-${envName}-${revision}`;
        this.resourceUri = uri;
        this.contextValue = 'revision';
        this.command = {
            command: 'vscode.open',
            title: 'Edit Environment',
            arguments: [uri],
        };
    }
}