import * as vscode from 'vscode';
import { isPulumiEscEditor, isPulumiEscDocument } from './editorHelper';
import EscApi from './api';
import { parseEnvUri } from './uriHelper';
import { CheckEnvironment } from './models';
import { Schema } from './language_service/schema';
import * as compose from "./language_service/yaml-compose";
import * as yaml from "./language_service/yaml-document";
import * as completion from "./language_service/completion-items";
import { FunctionSchemas } from './language_service/functions';
import * as hover from './language_service/hover';

interface Analysis {
    // The source code that was analyzed.
    source: string;
    // The YAML document.
    doc?: yaml.Document;
    // The AST, evaluated environment, and diagnostics.
    checkEnv?: CheckEnvironment;
    // The compiled schema.
    schema?: Schema;
    contextSchema?: Schema;
}

export class EscDiagnostics {

    private diagCollection: vscode.DiagnosticCollection;
    private checkEnvironment: CheckEnvironment | undefined;
    private getAnalysis: () => Promise<void>;
    private analysis: Analysis | undefined;
    private document: vscode.TextDocument | undefined;
    constructor(private api: EscApi, private functions: FunctionSchemas) {
        this.diagCollection = vscode.languages.createDiagnosticCollection('esc');
        this.getAnalysis = this.debounce(this.refreshDiagnostics.bind(this));
    }

    public async provideHover(document: vscode.TextDocument, position: vscode.Position, cancellationToken: vscode.CancellationToken): Promise<vscode.Hover> {
        const yamlDoc = await this.getYamlDoc(document);
        if (yamlDoc === undefined) {
            return new vscode.Hover([]);
        }
        return hover.provide(yamlDoc,
            this.analysis!.checkEnv?.exprs, 
            this.analysis!.schema, document.offsetAt(position), this.functions, cancellationToken);
    }

    public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
        const yamlDoc = await this.getYamlDoc(document);
        if (yamlDoc === undefined) {
            return [];
        }

        const items = await completion.provideSuggestions(
            yamlDoc,
            this.analysis!.checkEnv?.exprs,
            this.analysis!.schema,
            this.analysis!.contextSchema,
            document.offsetAt(position),
            this.functions,
        );


        const mappedItems: vscode.CompletionItem[] = items.map(item => ({
            ...item,
            range: undefined,
            kind: vscodeItemKind(item.kind),
        }));

        if (mappedItems.find(item => item.label === "fn::open::aws-login:") !== undefined) {
            mappedItems.push(...getSnippets());
        }

        return mappedItems;
    }

    private async getYamlDoc(document: vscode.TextDocument): Promise<yaml.Document | undefined> {
        this.document = document;
        await this.getAnalysis();
        if (this.analysis === undefined) {
            return undefined;
        }

        const definition =  this.document.getText();
        let yamlDoc: yaml.Document | undefined;
        yamlDoc = compose.yaml(definition);
        if (!yamlDoc.value) {
            return undefined;
        }

        return yamlDoc;
    }

    public subscribeToDocumentChanges(ctx: vscode.ExtensionContext): void {
        
        ctx.subscriptions.push(this.diagCollection);

        const editor = vscode.window.activeTextEditor;
        if (isPulumiEscEditor(editor)) {
            this.document = editor!.document;
            this.refreshDiagnostics();
        }

        ctx.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(async editor => {
                if (isPulumiEscEditor(editor)) {
                    await this.getAnalysis();
                }
            })
        );

        ctx.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(async e => {
                if (isPulumiEscDocument(e.document)) {
                    await this.getAnalysis();
                }
            })
        );

        ctx.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument(doc => {
                if (isPulumiEscDocument(doc)) {
                    this.diagCollection.delete(doc.uri);
                }
            })
        );
    }

    public registerCompletionItemProvider(ctx: vscode.ExtensionContext): void {
        ctx.subscriptions.push(
            vscode.languages.registerCompletionItemProvider('pulumi-esc', this, ".", ":", "\n", "{")
        );
    }

    public registerHoverProvider(ctx: vscode.ExtensionContext): void {
        ctx.subscriptions.push(
            vscode.languages.registerHoverProvider('pulumi-esc', this)
        );
    }

    debounce (func: () => Promise<void>): () => Promise<void> {
        let timeout: NodeJS.Timeout | undefined;
        return function () {
          return new Promise((resolve) => {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
              timeout = undefined;
              await func();
              resolve();
            }, 250);
          });
        };
      }

    async refreshDiagnostics(): Promise<void> {
        if (!this.document) {
            return;
        }

        const { org } = parseEnvUri(this.document.uri);
        const definition =  this.document.getText();
        let yamlDoc: yaml.Document | undefined;
        yamlDoc = compose.yaml(definition);
        if (!yamlDoc.value) {
            return;
        }
        this.checkEnvironment = await this.api.checkEnvironment(org, definition);
        const diagnostics = this.checkEnvironment.diagnostics;
        this.extractAnalysis(this.document, definition, yamlDoc);
        
        if (!diagnostics) {
            this.diagCollection.clear();
            return;
        }

        const vsDiagnostics = diagnostics.map(diag => {
            const range = new vscode.Range(
                new vscode.Position(fixRangePart(diag.range?.begin.line), fixRangePart(diag.range?.begin.column)),
                new vscode.Position(fixRangePart(diag.range?.end.line), fixRangePart(diag.range?.end.column)));

            return new vscode.Diagnostic(range, diag.summary, vscode.DiagnosticSeverity.Error);
        });

        this.diagCollection.set(this.document.uri, vsDiagnostics);
    }

    extractAnalysis(doc: vscode.TextDocument, source: string, yamlDoc: yaml.Document) {
        this.analysis = {
            source,
            doc: yamlDoc,
            checkEnv: this.checkEnvironment,
            schema: this.getContextSchema(),
            contextSchema: this.checkEnvironment?.schema === undefined ? undefined : Schema.new(this.checkEnvironment.schema),
        };
    }

    getContextSchema(): Schema | undefined {
        const schema = this.checkEnvironment?.executionContext?.schema;
        return schema === undefined
                            ? undefined
                            : Schema.new({
                                  type: "object",
                                  additionalProperties: false,
                                  properties: {
                                      context: schema,
                                  },
                              });
    }
}

function fixRangePart(part: number | undefined): number {
    if (!part || part === 0) {
        return 0;
    }

    return part - 1;
}

function vscodeItemKind(kind: completion.CompletionItemKind): vscode.CompletionItemKind {
    switch (kind) {
        case completion.CompletionItemKind.Method:
            return vscode.CompletionItemKind.Method;
        case completion.CompletionItemKind.Function:
            return vscode.CompletionItemKind.Function;
        case completion.CompletionItemKind.Constructor:
            return vscode.CompletionItemKind.Constructor;
        case completion.CompletionItemKind.Field:
            return vscode.CompletionItemKind.Field;
        case completion.CompletionItemKind.Variable:
            return vscode.CompletionItemKind.Variable;
        case completion.CompletionItemKind.Class:
            return vscode.CompletionItemKind.Class;
        case completion.CompletionItemKind.Struct:
            return vscode.CompletionItemKind.Struct;
        case completion.CompletionItemKind.Interface:
            return vscode.CompletionItemKind.Interface;
        case completion.CompletionItemKind.Module:
            return vscode.CompletionItemKind.Module;
        case completion.CompletionItemKind.Property:
            return vscode.CompletionItemKind.Property;
        case completion.CompletionItemKind.Event:
            return vscode.CompletionItemKind.Event;
        case completion.CompletionItemKind.Operator:
            return vscode.CompletionItemKind.Operator;
        case completion.CompletionItemKind.Unit:
            return vscode.CompletionItemKind.Unit;
        case completion.CompletionItemKind.Value:
            return vscode.CompletionItemKind.Value;
        case completion.CompletionItemKind.Constant:
            return vscode.CompletionItemKind.Constant;
        case completion.CompletionItemKind.Enum:
            return vscode.CompletionItemKind.Enum;
        case completion.CompletionItemKind.EnumMember:
            return vscode.CompletionItemKind.EnumMember;
        case completion.CompletionItemKind.Keyword:
            return vscode.CompletionItemKind.Keyword;
        case completion.CompletionItemKind.Text:
            return vscode.CompletionItemKind.Text;
        case completion.CompletionItemKind.Color:
            return vscode.CompletionItemKind.Color;
        case completion.CompletionItemKind.File:
            return vscode.CompletionItemKind.File;
        case completion.CompletionItemKind.Reference:
            return vscode.CompletionItemKind.Reference;
        case completion.CompletionItemKind.Folder:
            return vscode.CompletionItemKind.Folder;
        case completion.CompletionItemKind.TypeParameter:
            return vscode.CompletionItemKind.TypeParameter;
        case completion.CompletionItemKind.User:
            return vscode.CompletionItemKind.User;
        case completion.CompletionItemKind.Issue:
            return vscode.CompletionItemKind.Issue;
        case completion.CompletionItemKind.Snippet:
            return vscode.CompletionItemKind.Snippet;
        default:
            throw new Error(`unexpected completion item kind ${kind}`);
    }
}


function getSnippets(): vscode.CompletionItem[] {
    return [
        {
            label: "aws-login-oidc",
            insertText: new vscode.SnippetString(`
fn::open::aws-login:
    oidc:
        roleArn: $1
        sessionName: $2
        duration: \${3:1h}`),
            documentation: "aws-login provider for oidc",
            kind: vscode.CompletionItemKind.Snippet,
        },
        {
            label: "aws-secrets",
            insertText: new vscode.SnippetString(`
fn::open::aws-secrets:
    region: \${1:us-west-2}
    login: \${2:\$\{aws.login\}}
    get:
        \${3:key}:
            secretId: $4`),
            documentation: "aws-secrets provider",
            kind: vscode.CompletionItemKind.Snippet,
        },
        {
            label: "azure-login-oidc",
            insertText: new vscode.SnippetString(`
fn::open::azure-login:
    oidc:
        clientId: $1
        tenantId: $2
        subscriptionId: $3
        oidc: true`),
            documentation: "azure-login provider for oidc",
            kind: vscode.CompletionItemKind.Snippet,
        },
        {
            label: "azure-vault",
            insertText: new vscode.SnippetString(`
fn::open::azure-secrets:
    login: \${1:\$\{azure.login\}}
    vault: \${2:vault-name}
    get:
        \${3:key}:
            name: $4`),
            documentation: "azure-vault provider",
            kind: vscode.CompletionItemKind.Snippet,
        },
        {
            label: "gcp-login-oidc",
            insertText: new vscode.SnippetString(`
fn::open::gcp-login:
    project: $1
    oidc:
        workloadPoolId: $2
        providerId: $3
        serviceAccount: $4`),
            documentation: "gcp-login provider for oidc",
            kind: vscode.CompletionItemKind.Snippet,
        },
        {
            label: "gcp-secrets",
            insertText: new vscode.SnippetString(`
fn::open::gcp-secrets:
    login: \${1:\$\{gcp.login\}}
    get:
        \${2:key}:
            name: $3`),
            documentation: "gcp-secrets provider",
            kind: vscode.CompletionItemKind.Snippet,
        },
        {
            label: "vault-login",
            insertText: new vscode.SnippetString(`
fn::open::vault-login:
    address: $1
    jwt:
        role: $2`),
            documentation: "vault-login provider",
            kind: vscode.CompletionItemKind.Snippet,
        },
        {
            label: "vault-secrets",
            insertText: new vscode.SnippetString(`
fn::open::vault-secrets:
    login: \${1:\$\{vault.login\}}
    get:
        \${2:key}:
            path: $3`),
            documentation: "vault-secrets provider",
            kind: vscode.CompletionItemKind.Snippet,
        },
        {
            label: "1password-secrets",
            insertText: new vscode.SnippetString(`
fn::open::1password-secrets:
    login:
        serviceAccountToken:
            fn::secret: $1
    get:
        \${2:key}:
            ref: $3`),
            documentation: "1password-secrets provider",
            kind: vscode.CompletionItemKind.Snippet,
        },
        {
            label: "pulumi-stacks",
            insertText: new vscode.SnippetString(`
fn::open::pulumi-stacks:
    stacks:
        \${1:key}:
            stack: $2`),
            documentation: "pulumi-stacks provider",
            kind: vscode.CompletionItemKind.Snippet,
        },
    ];
}