import * as vscode from 'vscode';
export const PulumiScheme = "pulumi";

export function formEnvUri(org: string, name: string, suffix: string = ""): vscode.Uri {
    return vscode.Uri.parse(`${PulumiScheme}://env/${org}/${name}${suffix}`);
}


export function formOrgUri(org: string): vscode.Uri {
    return vscode.Uri.parse(`${PulumiScheme}://org/${org}`);
}

export function parseEnvUri(uri: vscode.Uri): { org: string, envName: string } {
    const [_, org, envName] = uri.path.split("/");
    return { org, envName };
}

export function parseOrgUri(uri: vscode.Uri): string {
    const [_, org] = uri.path.split("/");
    return org;
}

export function parseRevision(uri: vscode.Uri): string {
    const parts = uri.path.split("rev/");
    return parts[1];
}

export function isPulumiUri(uri: vscode.Uri | undefined): boolean {
    return uri?.scheme === PulumiScheme;
}