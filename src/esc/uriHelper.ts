import * as vscode from 'vscode';
export const PulumiScheme = "pulumi";

export function formEnvUri(org: string, project:string, name: string, suffix: string = ""): vscode.Uri {
    return vscode.Uri.parse(`${PulumiScheme}://env/${org}/${project}/${name}${suffix}`);
}

export function formEnvUriFromImportRef(org: string, ref: string): vscode.Uri {
    ref = ref.replace("@", "/rev/");
    return vscode.Uri.parse(`${PulumiScheme}://env/${org}/${ref}`);
}

export function formOrgUri(org: string): vscode.Uri {
    return vscode.Uri.parse(`${PulumiScheme}://org/${org}`);
}

export function formSearchUri(): vscode.Uri {
    return vscode.Uri.parse(`${PulumiScheme}://search`);
}

export function parseEnvUri(uri: vscode.Uri): { org: string, project: string, envName: string } {
    const [_, org, project, envName] = uri.path.split("/");
    return { org, project, envName };
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