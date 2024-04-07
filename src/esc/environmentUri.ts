import * as vscode from 'vscode';

export function formEnvUri(org: string, name: string, suffix: string = ""): vscode.Uri {
    return vscode.Uri.parse(`pulumi://env/${org}/${name}${suffix}`);
}

export function parseEnvUri(uri: vscode.Uri): { org: string, envName: string } {
    const [_, org, envName] = uri.path.split("/");
    return { org, envName };
}

export function parseRevision(uri: vscode.Uri): string {
    const parts = uri.path.split("revision/");
    return parts[1];
}