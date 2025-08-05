import * as vscode from 'vscode';
import EscApi from './api';
import * as yaml from "js-yaml";
import * as uriHelper from './uriHelper';
import { randomInt } from 'crypto';
import * as config from './config';

const defaultYaml = `# See https://www.pulumi.com/docs/esc/reference/ for additional examples.

# ---------------------------------------------------------------------------------------
# Imports section names the environments to import. Environments are merged in order
# per JSON merge patch.
# ---------------------------------------------------------------------------------------

# imports is an optional top-level key
# imports:
#   - project/environment-a
#   - project/environment-b@stable

# ---------------------------------------------------------------------------------------
# Main configuration -- set configuration values either as static values, or interpolated
# from other sources. Values are merged onto imported environments per JSON merge patch.
# ---------------------------------------------------------------------------------------

# values is a required top-level key
values:
  example:
    setting: changeme
  example2:
    setting: \${example.setting}

  # ---------------------------------------------------------------------------------------
  # Exports -- expose configuration values to particular consumers
  # ---------------------------------------------------------------------------------------

  # Configuration nested under the "environmentVariables" key is used to export environment
  # variables when using \`esc open --format shell\`, \`esc run\`, or \`pulumi up/preview/refresh/destroy\`
  environmentVariables:
    EXAMPLE_SETTING: \${example.setting}

  # Configuration nested under the "pulumiConfig" key will be available to Pulumi stacks that
  # reference this Environment during \`pulumi up/preview/refresh/destroy\`
  pulumiConfig:
    example: \${example.setting}`;

export class EnvironmentFileSystemProvider implements vscode.FileSystemProvider, vscode.TextDocumentContentProvider {

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;
    private updates = new Map<string, number>();
    private sizes = new Map<string, number>();
    private watches = new Map<vscode.Uri, boolean>();
    private etags = new Map<string, string>();
    constructor(private api: EscApi) {}

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        const parts = uri.path.split("/");
        if (parts.includes('rev')) {
            return {
                type: vscode.FileType.File,
                ctime: 0,
                mtime: 0,
                size: 0,
            };
        }

        let uriStr = uri.toString();
        const isOpen = parts.includes('open');
        if (isOpen) {
            uriStr = this.getOpenEnvPrefix(uri.toString());
        }
        
        if (!this.updates.has(uriStr)) {
            this.updates.set(uriStr, Date.now());
        }

        const mtime = this.updates.get(uriStr) || 0;
        const size = this.sizes.get(uriStr) || randomInt(1000);

        if (isOpen) {
            return {
                type: vscode.FileType.File,
                ctime: 0,
                mtime: mtime,
                size: size,
                permissions: vscode.FilePermission.Readonly
            };
        }

        return {
            type: vscode.FileType.File,
            ctime: 0,
            mtime: mtime,
            size: size,
        };
    }

    private getOpenEnvPrefix(uriStr: string) {
        const index = uriStr.lastIndexOf('/open');
        const envPath = uriStr.slice(0, index);
        return envPath;
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        let content = await this.getResourceYaml(uri);
        
        this.sizes.set(uri.toString(), content.toString().length);
        return Buffer.from(content);
    }

    private async getResourceYaml(uri: vscode.Uri) {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);

        if (uriHelper.isChangeRequestUri(uri)) {
            return await this.getChangeRequestYaml(uri);
        }

        if (uriHelper.isDecryptUri(uri)) {
            return await this.getDecryptedEnvironmentYaml(uri);
        }

        if (uriHelper.isRevisionUri(uri)) {
            return await this.getRevisionYaml(uri);
        } 

        if (uriHelper.isOpenUri(uri)) {
            return await this.getOpenedEnvironmentYaml(uri);
        } 
         
        return await this.getEnvironmentYaml(uri);
    }

    private async getChangeRequestYaml(uri: vscode.Uri): Promise<string> {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);
        const changeRequestId = uriHelper.parseChangeRequestId(uri);
        if (changeRequestId) {
            const result = await this.api.getChangeRequestDraft(org, project, envName, changeRequestId);
            // Store the ETag for later use in writes
            this.etags.set(uri.toString(), result.etag);
            return result.content;
        }

        throw new Error("Couldn't get change request content. Invalid change request ID.");
    }

    private async getDecryptedEnvironmentYaml(uri: vscode.Uri): Promise<string> {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);
        const yaml = await this.api.decryptEnvironment(org, project, envName);
        return yaml;
    }

    private async getRevisionYaml(uri: vscode.Uri): Promise<string> {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);
        const revision = uriHelper.parseRevision(uri);
        const yaml = await this.api.getEnvironmentRevision(org, project, envName, revision);
        return yaml;
    }

    private async getOpenedEnvironmentYaml(uri: vscode.Uri): Promise<string> {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);
        const format = uri.path.split('/').pop();
        const env = await this.api.openEnvironment(org, project, envName);
        const environment = valueToJSON({ value: env.properties || {} }, false);
        switch (format) {
            case "json":
                return JSON.stringify(environment, null, 2);
            case "yaml":
                return yaml.dump(environment);
            case "shell":
            case "dotenv":
                return jsonEnvToFormat(environment, format);
            default:
                vscode.window.showErrorMessage(`Invalid format: ${format}`);
                return "";
        }
    }

    private async getEnvironmentYaml(uri: vscode.Uri): Promise<string> {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);
        const yaml = await this.api.getEnvironment(org, project, envName);
        if (!yaml || yaml.length === 0) {
            return defaultYaml;
        }
        return yaml;
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, _options: { create: boolean, overwrite: boolean }): Promise<void> {
        const existingContent = await this.getResourceYaml(uri);
        const contentStr = content.toString();

        if (existingContent === contentStr) {
            return;
        }

        if (uriHelper.isChangeRequestUri(uri)) {
            return await this.updateChangeRequestDraft(uri, contentStr);
        } 
        
        return await this.updateEnvironment(uri, contentStr, existingContent);
    }

    private async updateChangeRequestDraft(uri: vscode.Uri, contentStr: string): Promise<void> {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);

        const changeRequestId = uriHelper.parseChangeRequestId(uri);

        if (!changeRequestId) {
            throw new Error('Change Request ID not found in URI. Cannot update Change Request Draft.');
        }
  
        const etag = this.etags.get(uri.toString());
        if (!etag) {
            throw new Error('ETag not found for change request draft. Please reload the document.');
        }
        const result = await this.api.patchChangeRequestDraft(org, project, envName, changeRequestId, contentStr, etag);
        this.etags.set(uri.toString(), result.etag);

        const uriStr = uri.toString();
        this.updates.set(uriStr, Date.now());
        this.sizes.set(uriStr, contentStr.length);

        this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);

        const changeRequestUrl = `${config.consoleUrl()}/${org}/esc/${project}/${envName}?version=${changeRequestId}`;
        vscode.window.showInformationMessage('Updated Change Request. New revision added', 'Open Change Request in Browser').then(selection => {
            if (selection === 'Open Change Request in Browser') {
                vscode.env.openExternal(vscode.Uri.parse(changeRequestUrl));
            }
        });

        await this.refreshFileStats(uri);
    }

    private async updateEnvironment(uri: vscode.Uri, contentStr: string, existingContent: string) {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);
        try {
            await this.api.patchEnvironment(org, project, envName, contentStr);
         } catch (patchError: any) {
            if (patchError.status !== 409) {
                throw patchError;
            }
            // If error code is 409, means the environment has approvals enabled.
            const metadata = await this.api.getEnvironmentMetadata(org, project, envName);  
            if (metadata.activeChangeRequest?.changeRequestId) {
                return this.offerOpenExistingChangeRequest(uri, metadata.activeChangeRequest?.changeRequestId);
            }

            return this.offerCreateChangeRequest(uri, contentStr, existingContent.toString());
        }

        await this.refreshFileStats(uri);
    }

    private async offerOpenExistingChangeRequest(uri: vscode.Uri, changeRequestId: string) {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);

        const message = `Cannot save changes to "${envName}" because it has an active change request. You must resolve the change request first.`;
        const changeRequestUrl = `${config.consoleUrl()}/${org}/esc/${project}/${envName}?version=${changeRequestId}`;

        const selection = await vscode.window.showErrorMessage(message, 'Open Draft in Editor', 'Open Change Request in Browser', 'Cancel');
        if (selection === 'Open Draft in Editor') {
            const changeRequestUri = uriHelper.formChangeRequestUri(org, project, envName, changeRequestId);
            await vscode.commands.executeCommand('pulumi.esc.edit-change-request-in-editor', changeRequestUri);
        } else if (selection === 'Open Change Request in Browser') {
            vscode.env.openExternal(vscode.Uri.parse(changeRequestUrl));
        }
    }

       private async offerCreateChangeRequest(uri: vscode.Uri, contentStr: string, existingContent: string) {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);

        const selection = await vscode.window.showErrorMessage(
                `Cannot save changes to "${envName}". You need to create a Change Request.`,
                'Create Change Request',
                'Cancel'
            );
            
        if (selection !== 'Create Change Request') {
            return;
        }

        const changeRequestId = await this.api.createChangeRequestDraft(org, project, envName, contentStr);

        const description = await vscode.window.showInputBox({
            prompt: 'Enter a description for this change request',
            placeHolder: 'Describe your changes...'
        });

        await this.api.submitChangeRequest(changeRequestId, description ?? "");

        // Update file system state to mark as saved (revert to original state)
        const uriStr = uri.toString();
        this.updates.set(uriStr, Date.now());
        this.sizes.set(uriStr, existingContent.length);

        // Fire change event to notify VS Code the file has been "saved" (reverted)
        this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);

        // Force reload the document to show original content
        const openEditors = vscode.window.visibleTextEditors.filter(editor => 
            editor.document.uri.toString() === uri.toString()
        );
        for (const editor of openEditors) {
            // Reload the document by closing and reopening it
            await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
            await vscode.commands.executeCommand('vscode.open', uri);
        }

        await vscode.commands.executeCommand('pulumi.esc.refresh');

        // Show non-blocking notification
        const changeRequestUrl = `${config.consoleUrl()}/${org}/esc/${project}/${envName}?version=${changeRequestId}`;
        vscode.window.showInformationMessage(
            'Change request created successfully!',
            'Open Change Request in Browser',
            'Open Draft in Editor'
        ).then(result => {
            if (result === 'Open Change Request in Browser') {
                vscode.env.openExternal(vscode.Uri.parse(changeRequestUrl));
            } else if (result === 'Open Draft in Editor') {
                const changeRequestUri = uriHelper.formChangeRequestUri(org, project, envName, changeRequestId);
                vscode.commands.executeCommand('pulumi.esc.edit-change-request-in-editor', changeRequestUri);
            }
        });
    }

    private async refreshFileStats(uri: vscode.Uri) {
        const uriStr = uri.toString();
        this.updates.set(uriStr, Date.now());

        this.sizes.delete(uriStr);
        const watchFires = new Map<vscode.Uri, vscode.FileChangeEvent>();
        watchFires.set(uri, { type: vscode.FileChangeType.Changed, uri });
        for (const [watch, _] of this.watches) {
            if (watch.toString().startsWith(uriStr)) {
                watchFires.set(watch, { type: vscode.FileChangeType.Changed, uri: watch });
            }
        }
        this._emitter.fire(Array.from(watchFires.values()));

        await vscode.commands.executeCommand('pulumi.esc.refresh');
    }

    async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
        const { org, project, envName } = uriHelper.parseEnvUri(uri);
        await this.api.deleteEnvironment(org, project, envName);
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const {org} = uriHelper.parseEnvUri(uri);
        const environments = await this.api.listAllEnvironments(org);
        return environments.map(env => [`${env.project || "default"}\\${env.name}`, vscode.FileType.File]);
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        throw new Error("Not supported");
    }

    watch(resource: vscode.Uri, opts: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        this.watches.set(resource, true);
        return new vscode.Disposable(() => { this.watches.delete(resource); });
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
        throw new Error("Not supported");
    }

    private _fileChanged = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange?: vscode.Event<vscode.Uri> | undefined = this._fileChanged.event;
    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return this.getResourceYaml(uri);
    }
}

export function valueToJSON(v: any, redact: boolean = true): any {
    if (v.secret && redact) {
        return "[secret]";
    }

    if (v.unknown) {
        return "[unknown]";
    }

    if (Array.isArray(v.value)) {
        return v.value.map((element) => valueToJSON(element, redact));
    } else if (v.value !== null && typeof v.value === "object") {
        return Object.fromEntries(Object.entries(v.value).map(([key, value]) => [key, valueToJSON(value, redact)]));
    } else {
        return v.value;
    }
}

export function jsonEnvToFormat(env: any, format: string): string {
    if (!env.environmentVariables) {
        vscode.window.showErrorMessage(`There are no environment variables listed in this environment, or they have been misconfigured.
        Environment variables must be listed under the \`values.environmentVariables\` key in the document.
        
        For example, the following environment exposes a single env var, AWS_REGION, with the value "us-west-2".
        
        values:
          aws:
            region: us-west-2
          environmentVariables:
            AWS_REGION: \${aws.region}
        `);
        return "";
    }

    const lines: string[] = [];
    const { environmentVariables } = env;
    for (const key of Object.keys(environmentVariables)) {
        const value = environmentVariables[key];
        switch (format) {
            case "shell":
                if (typeof value === "string") {
                    lines.push(`export ${key}="${value}"`);
                } else {
                    lines.push(`export ${key}=${JSON.stringify(value)}`);
                }
                break;
            case "dotenv":
                if (typeof value === "string") {
                    lines.push(`${key}="${value}"`);
                } else {
                    lines.push(`${key}=${JSON.stringify(value)}`);
                }
                break;
        }
    }

    return lines.join("\n");
}
