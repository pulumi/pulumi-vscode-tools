/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
/*
 * pulumiDebug.ts implements the Debug Adapter that "adapts" or translates the Debug Adapter Protocol (DAP) used by the client (e.g. VS Code)
 * into requests and events of the real "execution engine" or "debugger" (here: Pulumi Automation API).
 * When implementing your own debugger extension for VS Code, most of the work will go into the Debug Adapter.
 * Since the Debug Adapter is independent from VS Code, it can be used in any client (IDE) supporting the Debug Adapter Protocol.
 *
 * The most important class of the Debug Adapter is the PulumiDebugSession which implements many DAP requests by talking to the engine.
 */

import * as vscode from 'vscode';
import {
	InitializedEvent,
	LoggingDebugSession,
	TerminatedEvent,
	Thread
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { Subject } from 'await-notify';

/**
 * This interface describes the pulumi-debug specific launch attributes
 * (which are not part of the Debug Adapter Protocol).
 * The schema for these attributes lives in the package.json of the pulumi-vscode-tools extension.
 * The interface should always match this schema.
 */
interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** Deployment command (up, preview, destroy). */
	command: string;
	/** The name of the stack to operate on. Defaults to the current stack */
	stack?: string;
	/** Run pulumi as if it had been started in another directory. */
	workspaceFolder?: string;
	/** Automatically stop target after launch. If not specified, target does not stop. */
	stopOnEntry?: boolean;
	/** run without debugging */
	noDebug?: boolean;
}

export class PulumiDebugSession extends LoggingDebugSession {

	private _session: vscode.DebugSession;

	// we don't support multiple threads, so we can use a hardcoded ID for the default thread
	private static threadID = 1;

	private _configurationDone = new Subject();

	private _cancellationTokens = new Map<number, boolean>();

	private _reportProgress = false;
	private _progressId = 10000;
	private _cancelledProgressId: string | undefined = undefined;
	private _isProgressCancellable = true;

	private _valuesInHex = false;

	private _addressesInHex = true;

	/**
	 * Creates a new debug adapter that is used for one debug session.
	 * We configure the default implementation of a debug adapter here.
	 */
	public constructor(session: vscode.DebugSession, fileAccessor: FileAccessor) {
		super("mock-debug.txt");
		this._session = session;

		// this debugger uses zero-based lines and columns
		this.setDebuggerLinesStartAt1(false);
		this.setDebuggerColumnsStartAt1(false);
	}

	/**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

		if (args.supportsProgressReporting) {
			this._reportProgress = true;
		}

		// build and return the capabilities of this debug adapter:
		response.body = response.body || {};

		// the adapter implements the configurationDone request.
		response.body.supportsConfigurationDoneRequest = true;

		// make VS Code send cancel request
		response.body.supportsCancelRequest = true;

		response.body.supportTerminateDebuggee = true;
		response.body.supportsTerminateRequest = true;

		this.sendResponse(response);

		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendEvent(new InitializedEvent());
	}

	/**
	 * Called at the end of the configuration sequence.
	 * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		this._configurationDone.notify();
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
		console.log(`disconnectRequest suspend: ${args.suspendDebuggee}, terminate: ${args.terminateDebuggee}`);
	}

	// protected async attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArguments) {
	// 	return this.launchRequest(response, args);
	// }

	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) {
		console.log(`launchRequest args: ${JSON.stringify(args)}`);

		// wait 1 second until configuration has finished (and configurationDoneRequest has been called)
		await this._configurationDone.wait(1000);

		// start the program in the runtime
		// await this._runtime.start(args.program, !!args.stopOnEntry, !args.noDebug);

		if (args.stack) {
			// simulate a compile/build error in "launch" request:
			// the error should not result in a modal dialog since 'showUser' is set to false.
			// A missing 'showUser' should result in a modal dialog.
			this.sendErrorResponse(response, {
				id: 1001,
				format: `compileerror: some fake error.`,
				showUser: true
			});
		} else {
			this.sendResponse(response);
		}

		setTimeout(() => {
			// simulate a dynamic attach to the language runtime; in practice, this will happen in response to engine events.
			vscode.debug.startDebugging(undefined,
				{
					name: "Pulumi Program (Python)",
					request: "launch",
					type: "python",
					program: "main.py"
				},
				{ 
					noDebug: false, 
					parentSession: this._session,
				}
			);
		});
	}

	// protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> {
	// 	response.body = {
	// 		breakpoints: []
	// 	};
	// 	this.sendResponse(response);
	// }

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		// runtime supports no threads so just return a default thread.
		response.body = {
			threads: [
				new Thread(PulumiDebugSession.threadID, "main thread")
			]
		};
		this.sendResponse(response);
	}

	protected cancelRequest(response: DebugProtocol.CancelResponse, args: DebugProtocol.CancelArguments) {
		if (args.requestId) {
			this._cancellationTokens.set(args.requestId, true);
		}
		if (args.progressId) {
			this._cancelledProgressId = args.progressId;
		}
	}

	protected terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments, request?: DebugProtocol.Request | undefined): void {
		console.log(`terminateRequest args: ${JSON.stringify(args)}`);
		this.sendResponse(response);
		this.sendEvent(new TerminatedEvent());
	}

	//---- helpers
}

export interface FileAccessor {
	isWindows: boolean;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, contents: Uint8Array): Promise<void>;
}