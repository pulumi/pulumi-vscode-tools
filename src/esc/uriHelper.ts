import * as vscode from 'vscode';
export const PulumiScheme = "pulumi";

export function formEnvUri(org: string, project:string, name: string, suffix: string = ""): vscode.Uri {
    return vscode.Uri.parse(`${PulumiScheme}://env/${org}/${project}/${name}${suffix}`);
}

export function formChangeRequestUri(org: string, project: string, name: string, changeRequestId: string): vscode.Uri {
    return vscode.Uri.parse(`${PulumiScheme}://env/${org}/${project}/${name}/cr/${changeRequestId}`);
}

export function formChangeRequestUriWithDisplayName(org: string, project: string, name: string, changeRequestId: string, displayName: string): vscode.Uri {
    // Encode the actual change request ID in the fragment, and use the display name in the path
    return vscode.Uri.parse(`${PulumiScheme}://env/${org}/${project}/${name}/cr/${encodeURIComponent(displayName)}#${changeRequestId}`);
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
    if (parts.length !== 2) {
        return "latest";
    }
    return parts[1];
}

export function parseChangeRequestId(uri: vscode.Uri): string | null {
    // The actual change request ID is stored in the fragment
    if (uri.fragment) {
        return uri.fragment;
    }
    return null;
}

export function isChangeRequestUri(uri: vscode.Uri): boolean {
    return uri.path.includes("/cr/");
}

export function isPulumiUri(uri: vscode.Uri | undefined): boolean {
    return uri?.scheme === PulumiScheme;
}