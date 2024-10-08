import * as vscode from 'vscode';
import EscApi from './api';
import * as yaml from "js-yaml";
import { parseEnvUri, parseRevision } from './uriHelper';
import { randomInt } from 'crypto';

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
        let content = await this.getEnvironmentYaml(uri);
        
        this.sizes.set(uri.toString(), content.toString().length);
        return Buffer.from(content);
    }

    private async getEnvironmentYaml(uri: vscode.Uri) {
        const { org, project, envName } = parseEnvUri(uri);
        
        const parts = uri.path.split("/");
        if (parts.includes('decrypt')) {
            const yaml = await this.api.decryptEnvironment(org, project, envName);
            return yaml;
        } else if (parts.includes('rev')) {
            const revision = parseRevision(uri);
            const yaml = await this.api.getEnvironmentRevision(org, project, envName, revision);
            return yaml;
        } else if (parts.includes('open')) {
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
        } else {
            const yaml = await this.api.getEnvironment(org, project, envName);
            if (!yaml || yaml.length === 0) {
                return defaultYaml;
            }

            return yaml;
        }
        
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): Promise<void> {
        const existingContent = await this.getEnvironmentYaml(uri);
        if (existingContent === content.toString()) {
            return;
        }

        const { org, project, envName } = parseEnvUri(uri);
        const contentStr = content.toString();
        await this.api.patchEnvironment(org, project, envName, contentStr);
        const uriStr = uri.toString();
        this.updates.set(uriStr, Date.now());
        
        this.sizes.delete(uriStr);
        const watchFires = new Map<vscode.Uri, vscode.FileChangeEvent>();
        watchFires.set(uri, { type: vscode.FileChangeType.Changed, uri });
        for (const[watch,_] of this.watches) {
            if (watch.toString().startsWith(uriStr)) {
                watchFires.set(watch, { type: vscode.FileChangeType.Changed, uri: watch });
            }
        }
        this._emitter.fire(Array.from(watchFires.values()));

        await vscode.commands.executeCommand('pulumi.esc.refresh');
    }

    async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
        const { org, project, envName } = parseEnvUri(uri);
        await this.api.deleteEnvironment(org, project, envName);
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const {org} = parseEnvUri(uri);
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
        return this.getEnvironmentYaml(uri);
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