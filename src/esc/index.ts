import * as vscode from 'vscode';
import { EnvironmentsTreeDataProvider, trackEnvironmentEditorSelection, onOpenLanguageSelector } from './env_tree_data_provider';
import { EnvironmentFileSystemProvider } from './environment_fs_provider';
import { addEnvironmentCommand, decryptEnvironmentCommand, deleteEnvironmentCommand, openEnvironmentCommand, compareFilesCommands, tagRevisionCommand, runCommand } from './commands';
import EscApi from './api';
import { EscDiagnostics } from './escDiagnostics';

export function pulumiEscExplorer(context: vscode.ExtensionContext) {
    const api = new EscApi();
    const escTreeProvider = new EnvironmentsTreeDataProvider(context, api);
    const escEnvironmentProvider = new EnvironmentFileSystemProvider(api);
    const onOpen = vscode.workspace.onDidOpenTextDocument(onOpenLanguageSelector());
    const treeView = vscode.window.createTreeView("pulumi-esc-explorer", { treeDataProvider: escTreeProvider });
    const fs = vscode.workspace.registerFileSystemProvider('pulumi', escEnvironmentProvider, { isCaseSensitive: true });
    const docProvider = vscode.workspace.registerTextDocumentContentProvider('pulumi', escEnvironmentProvider);

    const addEnvCmd = addEnvironmentCommand(api);
    const openEnvCmd = openEnvironmentCommand();
    const deleteEnvCmd = deleteEnvironmentCommand(api);
    const decryptEnvCmd = decryptEnvironmentCommand();
    const compareFilesCmd = compareFilesCommands();
    const tagRevisionCmd = tagRevisionCommand(api);
    const runCmd = runCommand();
    const diagnostics = new EscDiagnostics(api);
    diagnostics.subscribeToDocumentChanges(context);
    
    const trackActiveEnv = vscode.window.onDidChangeActiveTextEditor(trackEnvironmentEditorSelection(escTreeProvider, treeView));
    context.subscriptions.push(treeView, docProvider, onOpen, fs, trackActiveEnv, addEnvCmd, openEnvCmd, deleteEnvCmd, decryptEnvCmd,tagRevisionCmd, compareFilesCmd, runCmd);
}