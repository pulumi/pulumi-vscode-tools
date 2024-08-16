import * as vscode from 'vscode';
import { EnvironmentsTreeDataProvider, trackEnvironmentEditorSelection, onOpenLanguageSelector } from './env_tree_data_provider';
import { EnvironmentFileSystemProvider } from './environment_fs_provider';
import * as commands from './commands';
import EscApi from './api';
import { EscDiagnostics } from './escDiagnostics';
import { PulumiAuthenticationProvider } from './authenticationProvider';


export async function pulumiEscExplorer(context: vscode.ExtensionContext) {
    const api = new EscApi();
    const escTreeProvider = new EnvironmentsTreeDataProvider(context, api);
    const escEnvironmentProvider = new EnvironmentFileSystemProvider(api);
    const onOpen = vscode.workspace.onDidOpenTextDocument(onOpenLanguageSelector());
    const treeView = vscode.window.createTreeView("pulumi-esc-explorer", { treeDataProvider: escTreeProvider });
    const fs = vscode.workspace.registerFileSystemProvider('pulumi', escEnvironmentProvider, { isCaseSensitive: true });
    const docProvider = vscode.workspace.registerTextDocumentContentProvider('pulumi', escEnvironmentProvider);

    const auth = new PulumiAuthenticationProvider(context);
    const signInCmd = commands.loginCommand();
    const addEnvCmd = commands.addEnvironmentCommand(api);
    const openEnvCmd = commands.openEnvironmentCommand();
    const deleteEnvCmd = commands.deleteEnvironmentCommand(api);
    const decryptEnvCmd = commands.decryptEnvironmentCommand();
    const compareFilesCmd = commands.compareFilesCommands();
    const tagRevisionCmd = commands.tagRevisionCommand(api);
    const runCmd = commands.runCommand();
    
    const diagnostics = new EscDiagnostics(api);
    diagnostics.subscribeToDocumentChanges(context);
    
    const trackActiveEnv = vscode.window.onDidChangeActiveTextEditor(trackEnvironmentEditorSelection(escTreeProvider, treeView));
    const sessionChanged = vscode.authentication.onDidChangeSessions(handleAuthSessionChange);

    context.subscriptions.push(treeView, docProvider, onOpen, fs, trackActiveEnv, sessionChanged,
        auth, signInCmd, addEnvCmd, openEnvCmd, deleteEnvCmd, decryptEnvCmd,tagRevisionCmd, compareFilesCmd, runCmd);
}

async function handleAuthSessionChange(e: vscode.AuthenticationSessionsChangeEvent): Promise<void> {
    await vscode.commands.executeCommand('pulumi.esc.refresh');
};