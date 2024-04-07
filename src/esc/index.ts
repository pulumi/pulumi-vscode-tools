import * as vscode from 'vscode';
import { EnvironmentsTreeDataProvider, trackEnvironmentEditorSelection, onOpenLanguageSelector } from './env_tree_data_provider';
import { EnvironmentFileSystemProvider } from './environment_fs_provider';
import { addEnvironmentCommand, decryptEnvironmentCommand, deleteEnvironmentCommand, openEnvironmentCommand, compareFilesCommands, tagRevisionCommand } from './commands';

export function pulumiEscExplorer(context: vscode.ExtensionContext) {
    const escTreeProvider = new EnvironmentsTreeDataProvider(context);
    const escEnvironmentProvider = new EnvironmentFileSystemProvider();
    const onOpen = vscode.workspace.onDidOpenTextDocument(onOpenLanguageSelector());
    const treeView = vscode.window.createTreeView("pulumi-esc-explorer", { treeDataProvider: escTreeProvider });
    const fs = vscode.workspace.registerFileSystemProvider('pulumi', escEnvironmentProvider, { isCaseSensitive: true });
    const docProvider = vscode.workspace.registerTextDocumentContentProvider('pulumi', escEnvironmentProvider);

    const addEnvCommand = addEnvironmentCommand();
    const openEnvCommand = openEnvironmentCommand();
    const deleteEnvCommand = deleteEnvironmentCommand();
    const decryptEnvCommand = decryptEnvironmentCommand();
    const compareFiles = compareFilesCommands();
    const tagRevision = tagRevisionCommand();
    const trackActiveEnv = vscode.window.onDidChangeActiveTextEditor(trackEnvironmentEditorSelection(escTreeProvider, treeView));
    context.subscriptions.push(treeView, docProvider, onOpen, fs, trackActiveEnv, addEnvCommand, openEnvCommand, deleteEnvCommand, decryptEnvCommand,tagRevision, compareFiles);
}