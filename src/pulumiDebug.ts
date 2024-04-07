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
	OutputEvent,
	TerminatedEvent,
	Thread
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { Subject } from 'await-notify';
import { EngineEvent, LocalProgramArgs, LocalWorkspace } from "@pulumi/pulumi/automation";

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
	stackName: string;
	/** Run pulumi as if it had been started in another directory. */
	workDir: string;
	/** environment variables */
	env?: { [key: string]: string; };
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

	private _abortController = new AbortController();

	/**
	 * Creates a new debug adapter that is used for one debug session.
	 * We configure the default implementation of a debug adapter here.
	 */
	public constructor(session: vscode.DebugSession, fileAccessor: FileAccessor) {
		super("pulumi-debug.log");
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

		// build and return the capabilities of this debug adapter:
		response.body = response.body || {};

		// the adapter implements the configurationDone request.
		response.body.supportsConfigurationDoneRequest = true;

		// the Automation API has no apparent ability to cancel an outstanding operation,
		// so how shall we support a termination request?
		response.body.supportsTerminateRequest = false;

		this.sendResponse(response);

		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendEvent(new InitializedEvent());
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		// runtime supports no threads so just return a default thread.
		response.body = {
			threads: [
				new Thread(PulumiDebugSession.threadID, "main thread")
			]
		};
		this.sendResponse(response);
	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		// runtime supports no breakpoints so just return an empty array.
		response.body = {
			breakpoints: []
		};
		this.sendResponse(response);
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

	protected launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) {
		console.info(`launchRequest args: ${JSON.stringify(args)}`);

		// start the stack operation
		this.executeAsync(args).catch((err) => {
			console.error(`execute error: ${err}`);
			this.sendEvent(new TerminatedEvent());
		});

		this.sendResponse(response);
	}

    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
		// abort any outstanding stack operation
		this._abortController.abort();
		super.disconnectRequest(response, args, request);
	}

	//---- helpers

	private async executeAsync(args: ILaunchRequestArguments) {

		// wait until configuration has finished (and configurationDoneRequest has been called)
		await this._configurationDone.wait();

		// Create our stack using a local program
		const programArgs: LocalProgramArgs = {
			stackName: args.stackName,
			workDir: args.workDir,
		};
		
		// create (or select if one already exists) a stack that uses our local program
		const stack = await LocalWorkspace.createOrSelectStack(programArgs, {
			envVars: {
				...args.env,
				...!args.noDebug && {"PULUMI_ENABLE_DEBUGGING": "true"}
			},
		});

		// start the program
		switch (args.command) {
			case "up":
				const upResult = await stack.up({ 
					onOutput: this.onOutput.bind(this),
					onEvent: this.onEngineEvent.bind(this), 
					color: "never",
					//signal: this._abortController.signal,
				});
				console.info(`up result: ${JSON.stringify(upResult)}`);
				break;
				
			case "preview":
				const previewResult = await stack.preview({ 
					onOutput: this.onOutput.bind(this),
					onEvent: this.onEngineEvent.bind(this), 
					color: "never",
					//signal: this._abortController.signal,
				});
				console.info(`preview result: ${JSON.stringify(previewResult)}`);
				break;

			case "destroy":
				const destroyResult = await stack.destroy({ 
					onOutput: this.onOutput.bind(this),
					onEvent: this.onEngineEvent.bind(this), 
					color: "never",
					//signal: this._abortController.signal,
				});
				console.info(`up result: ${JSON.stringify(destroyResult)}`);
				break;
		}
	}

	// onOutput is called when Pulumi produces output.
	private onOutput(out: string) {
		const e: DebugProtocol.OutputEvent = new OutputEvent(out, 'stdout');
		this.sendEvent(e);
	}

	// onEngineEvent is called when the Pulumi engine produces an event.
	private onEngineEvent(event: EngineEvent) {
		console.info(`engine event: ${JSON.stringify(event)}`);
		const e = event as EngineEventExtended;

		if (e.startDebuggingEvent) {
			this.startDebugging(e.startDebuggingEvent);
			return;
		}
		
		if (e.cancelEvent) {
			this.sendEvent(new TerminatedEvent());
			return;
		}
	}

	private startDebugging(event: StartDebuggingEvent) {
		vscode.debug.startDebugging(undefined,
			event.config,
			{ 
				noDebug: false, 
				parentSession: this._session,
				compact: false,
				suppressSaveBeforeStart: true,
				lifecycleManagedByParent: false,
			}
		).then(
			(success) => {
				if (!success) {
					console.error(`failed to start debugging: ${JSON.stringify(event.config)}`);
					this.sendEvent(new TerminatedEvent());
					return;
				}
				console.log(`started debugging: ${JSON.stringify(event.config)}`);
			},
			(err) => {
				console.error(`failed to start debugging: ${JSON.stringify(event.config)}: ${err}`);
				this.sendEvent(new TerminatedEvent());
			}
		);
	}
}

export interface FileAccessor {
	isWindows: boolean;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, contents: Uint8Array): Promise<void>;
}

// EngineEventExtended is a temporary extension of EngineEvent to support the startDebuggingEvent.
export interface EngineEventExtended extends EngineEvent{
    startDebuggingEvent?: StartDebuggingEvent;
}

export interface StartDebuggingEvent {
	config: vscode.DebugConfiguration;
}