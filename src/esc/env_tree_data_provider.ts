import * as vscode from 'vscode';
import EscApi from './api';
import { formEnvUri, formOrgUri, formSearchUri,  } from './uriHelper';
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
            await vscode.languages.setTextDocumentLanguage(document, "pulumi-esc");
        }
    };
}
  
type EscTreeItem = Organization | Project | Environment | Revision | Search;
export class EnvironmentsTreeDataProvider implements vscode.TreeDataProvider<EscTreeItem> {
    public _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
    private data = new Map<string, EscTreeItem>();
    public search:string = "";
    public searchTree:boolean = false;
    

    constructor(context: vscode.ExtensionContext, private api: EscApi) {
    }

    getTreeItem(element: EscTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: EscTreeItem): Promise<EscTreeItem[]> {
        if (await config.authToken() === "") {
            return [];
        }

        if (this.searchTree && this.search === "") {
            return [];
        }

        if (!element) {
            if (this.searchTree) {
                return new Array(new Search(this.search, vscode.TreeItemCollapsibleState.Expanded));
            }

            return await this.getOrganization();
        }

        if (element instanceof Search) {
            return await this.getOrganization();
        }

        if (element instanceof Organization) {
            return await this.getProjects(element);
        }

        if (element instanceof Project) {
            return element.environments;
        }

        if (element instanceof Environment) {
            return await this.getRevisions(element);
        } 

        return [];
    }

    private async getOrganization() {
        const user = await this.api.getUserInfo();
        const collapsibleState = (this.search === "")  ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded;
        const orgItems = user.organizations.map(org => new Organization(org.githubLogin, org.name, collapsibleState));
        orgItems.forEach(item => this.mapResourceUris(item));
        return orgItems;
    }

    private async getRevisions(env: Environment) {
        const { org, project, envName } = env;

        const revisions = await this.api.listRevisions(org, project, envName);

        const revItems = revisions.map(rev => new Revision(org, env.project, envName, rev.number, env, rev.tags || [], vscode.TreeItemCollapsibleState.None));
        revItems.forEach(item => this.mapResourceUris(item));

        return revItems;
    }

    private async getProjects(organization: Organization) {
        const { org } = organization;

        const environments = await this.api.listAllEnvironments(org);
        let envItems = environments.map(env => new Environment(org, env.project, env.name, vscode.TreeItemCollapsibleState.Collapsed));
        let collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        if (this.search) {
            envItems = envItems.filter((env) => env.envName.includes(this.search) || env.project.includes(this.search));
            collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }
        envItems.forEach(item => this.mapResourceUris(item));

        envItems.sort((a, b) => a.envName.localeCompare(b.envName));

        const projectMap = new Map<string, Environment[]>();
        envItems.forEach(env => {
            if (!projectMap.has(env.project)) {
                projectMap.set(env.project, []);
            }
            projectMap.get(env.project)?.push(env);
        });

        const projects = Array.from(projectMap).map(([project, envs]) => new Project(org, project, envs, collapsibleState));
        projects.sort((a, b) => a.project.localeCompare(b.project));
        return projects;
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

export class Project extends vscode.TreeItem {
    constructor(
        public readonly org: string,
        public readonly project: string,
        public readonly environments: Environment[],
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(project, collapsibleState);
        this.label = project;
        this.id = `env-${org}-${project}`;
        if (project === "default") {
            this.contextValue = 'defaultProject';
        } else {
            this.contextValue = 'project';
        }
        this.iconPath = new vscode.ThemeIcon("folder");
    }
}

export class Environment extends vscode.TreeItem {
    constructor(
        public readonly org: string,
        public readonly project: string,
        public readonly envName: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(envName, collapsibleState);
        this.label = envName;
        const uri = formEnvUri(org, project, envName);
        this.id = `env-${org}-${project}-${envName}`;
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
        public readonly project: string,
        public readonly envName: string,
        public readonly revision: number,
        public readonly parent: Environment,
        public readonly tags: string[],
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(envName, collapsibleState);
        this.label = revision.toString();
        this.description = this.tags.join(",");
        const base = formEnvUri(org, project, envName);
        const uri = vscode.Uri.joinPath(base, "rev", revision.toString());
        this.id = `env-${org}-${project}-${envName}-${revision}`;
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

export class Search extends vscode.TreeItem {
    constructor(
        public readonly search: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(search, collapsibleState);
        this.label = `Searching for "${search}"`;
        const uri = formSearchUri();
        this.id = `search`;
        this.resourceUri = uri;
        this.contextValue = 'search';
        this.iconPath = new vscode.ThemeIcon("search");
    }
}