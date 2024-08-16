
import * as vscode from 'vscode';

export function apiUrl(): string {
    const url = vscode.workspace.getConfiguration().get<string>('pulumi.api-url') || "https://api.pulumi.com";

    return cleanUrl(url);
} 

export function consoleUrl(): string {
    const url = vscode.workspace.getConfiguration().get<string>('pulumi.console-url') || "https://app.pulumi.com";

    return cleanUrl(url);
} 

function cleanUrl(url: string): string {
    const uri = vscode.Uri.parse(url);
    return `${uri.scheme}://${uri.authority}`;
}

export async function authToken(): Promise<string> {
    const session = await vscode.authentication.getSession("pulumi", [], { createIfNone: false });
    if (!session) {
        return "";
    }

    return session.accessToken;
}