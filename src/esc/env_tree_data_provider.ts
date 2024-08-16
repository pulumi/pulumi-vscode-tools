import * as vscode from 'vscode';
import EscApi from './api';
import { formEnvUri, formOrgUri,  } from './uriHelper';
import { isPulumiEscEditor, isPulumiEscDocument } from './editorHelper';
import * as config from "./config";

export function trackEnvironmentEditorSelection(escTreeProvider: EnvironmentsTreeDataProvider, treeView: vscode.TreeView<any>): (e: vscode.TextEditor | undefined) => any {
    return (editor) => {
        if (isPulumiEscEditor(editor)) {
            const element = escTreeProvider.getTreeItemByUri(editor!.document.uri);
            if (element) {
                treeView.reveal(element, { select: true, focus: true });
            }
        }
    };
}


export function onOpenLanguageSelector(): (e: vscode.TextDocument) => any {
    return async (document) => {
        if (isPulumiEscDocument(document) && document.languageId !== "yaml") {
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
  
type EscTreeItem = Organization | Environment | Revision;
export class EnvironmentsTreeDataProvider implements vscode.TreeDataProvider<EscTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
    private data = new Map<string, EscTreeItem>();
    

    constructor(context: vscode.ExtensionContext, private api: EscApi) {
        vscode.commands.registerCommand("pulumi.esc.refresh", () => {
            this._onDidChangeTreeData.fire(undefined);
          });
    }

    getTreeItem(element: EscTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: EscTreeItem): Promise<EscTreeItem[]> {
        if (await config.authToken() === "") {
            return [];
        }

        if (!element) {
            return await this.getOrganization();
        }
        if (element instanceof Organization) {
            return await this.getEnvironments(element);
        }
        if (element instanceof Environment) {
            return await this.getRevisions(element);
        } 

        return [];
    }

    private async getOrganization() {
        const user = await this.api.getUserInfo();
        const orgItems = user.organizations.map(org => new Organization(org.githubLogin, org.name, vscode.TreeItemCollapsibleState.Collapsed));
        orgItems.forEach(item => this.mapResourceUris(item));
        return orgItems;
    }

    private async getRevisions(env: Environment) {
        const { org, envName } = env;

        const revisions = await this.api.listRevisions(org, envName);

        const revItems = revisions.map(rev => new Revision(org, envName, rev.number, env, rev.tags || [], vscode.TreeItemCollapsibleState.None));
        revItems.forEach(item => this.mapResourceUris(item));

        return revItems;
    }

    private async getEnvironments(organization: Organization) {
        const { org } = organization;

        const environments = await this.api.listAllEnvironments(org);
        const envItems = environments.map(env => new Environment(org, env.name, vscode.TreeItemCollapsibleState.Collapsed));
        envItems.forEach(item => this.mapResourceUris(item));

        envItems.sort((a, b) => a.envName.localeCompare(b.envName));

        return envItems;
    }

    private mapResourceUris(element: EscTreeItem) {
        if (element.resourceUri) {
            this.data.set(element.resourceUri.toString(), element);
        }
    }

    async getParent(element: EscTreeItem): Promise<Environment | undefined> {
        if (element instanceof Revision) {
            return element.parent;
        }

        return undefined;
    }

    public getTreeItemByUri(uri: vscode.Uri): EscTreeItem | undefined {
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
        const uri = vscode.Uri.joinPath(base, "rev", revision.toString());
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

export class Organization extends vscode.TreeItem {
    constructor(
        public readonly org: string,
        public readonly orgName: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(orgName, collapsibleState);
        this.label = orgName;
        const uri = formOrgUri(org);
        this.id = `org-${org}`;
        this.resourceUri = uri;
        this.contextValue = 'organization';
        this.iconPath = new vscode.ThemeIcon("organization");
    }
}