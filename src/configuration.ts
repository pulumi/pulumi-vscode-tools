
import * as vscode from 'vscode';
import { LocalWorkspace, LocalWorkspaceOptions } from "@pulumi/pulumi/automation";

export async function createWorkspace(workdir: string, opts?: LocalWorkspaceOptions) {
	const envs = vscode.workspace.getConfiguration().get<{}>('pulumi.env');
    const ws = await LocalWorkspace.create({
		...opts,
		workDir: workdir,
		envVars: {...envs, ...opts?.envVars},
	});
	return ws;
}
