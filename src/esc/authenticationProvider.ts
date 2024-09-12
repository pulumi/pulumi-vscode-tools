import {
  window,
} from "vscode";
import * as vscode from "vscode";
import * as http from "http";
import * as cli from "./config";
import EscApi from "./api";
import * as crypto from "crypto";
import { promiseFromEvent } from "./utils";
import { lookupService } from "dns";
import { userInfo } from "os";

export const AUTH_TYPE = `pulumi`;
const AUTH_NAME = `Pulumi Cloud`;
const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`;

export class PulumiAuthenticationProvider
  implements vscode.AuthenticationProvider, vscode.Disposable
{
  private _sessionChangeEmitter =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  private _disposable: vscode.Disposable;

  constructor(private readonly context: vscode.ExtensionContext) {
    this._disposable = vscode.Disposable.from(
      vscode.authentication.registerAuthenticationProvider(
        AUTH_TYPE,
        AUTH_NAME,
        this,
        { supportsMultipleAccounts: false }
      )
    );

    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("pulumi.api-url")) {
        const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);
        if (!allSessions) {
          return;
        }

        const sessions = JSON.parse(allSessions);
        this.context.secrets.delete(SESSIONS_SECRET_KEY);
        this._sessionChangeEmitter.fire({
          added: [],
          removed: [sessions],
          changed: [],
        });
      }
    });
  }

  get onDidChangeSessions() {
    return this._sessionChangeEmitter.event;
  }

  /**
   * Get the existing sessions
   * @param scopes
   * @returns
   */
  public async getSessions(
    scopes?: string[]
  ): Promise<readonly vscode.AuthenticationSession[]> {
    const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);

    if (allSessions) {
      return JSON.parse(allSessions) as vscode.AuthenticationSession[];
    }

    return [];
  }

  /**
   * Create a new auth session
   * @param scopes
   * @returns
   */
  public async createSession(scopes: string[]): Promise<vscode.AuthenticationSession> {
    try {
      const token = await this.login(scopes);
      if (!token) {
        return Promise.reject("Login failed");
      }

      const escApi = new EscApi(token);
      const userinfo: { name: string; email: string } =
        await escApi.getUserInfo();

      if (userinfo.name === "") {
        userinfo.name = userinfo.email;
      }

      const session: vscode.AuthenticationSession = {
        id: crypto.randomUUID(),
        accessToken: token,
        account: {
          label: userinfo.name,
          id: userinfo.email,
        },
        scopes: [],
      };

      await this.context.secrets.store(
        SESSIONS_SECRET_KEY,
        JSON.stringify([session])
      );

      this._sessionChangeEmitter.fire({
        added: [session],
        removed: [],
        changed: [],
      });

      return session;
    } catch (e) {
      vscode.window.showErrorMessage(`Login failed: ${e}`);
      throw e;
    }
  }

  /**
   * Remove an existing session
   * @param sessionId
   */
  public async removeSession(sessionId: string): Promise<void> {
    const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);
    if (allSessions) {
      let sessions = JSON.parse(allSessions) as vscode.AuthenticationSession[];
      const sessionIdx = sessions.findIndex((s) => s.id === sessionId);
      const session = sessions[sessionIdx];
      sessions.splice(sessionIdx, 1);

      await this.context.secrets.store(
        SESSIONS_SECRET_KEY,
        JSON.stringify(sessions)
      );

      if (session) {
        this._sessionChangeEmitter.fire({
          added: [],
          removed: [session],
          changed: [],
        });
      }
    }
  }

  private async login(scopes: string[]): Promise<string> {
    return await vscode.window.withProgress<string>(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Logging in to Pulumi Cloud...",
        cancellable: true,
      },
      async (_, cancellationToken) => {
        const authMethod = await vscode.window.showQuickPick(['Access Token', 'Browser login'], {
            placeHolder: 'Authentication method',
        });
        if (authMethod === 'Access Token') {
          return await this.promptForToken();
        } 
        
        return await this.browserLogin(cancellationToken);
      }
    );
  }

  private async promptForToken() {
    const token = await window.showInputBox({
      prompt: "Enter your Pulumi access token",
      placeHolder: 'Pulumi access token',
      ignoreFocusOut: true,
      password: true,
    });

    if (!token) {
      throw new Error("No token provided");
    }
    return token;
  }

  private async browserLogin(cancellationToken: vscode.CancellationToken) {
    const nonce = crypto.randomBytes(32).toString("hex");

    const server = http.createServer();
    const promise = new Promise<string>((resolve, reject) => {
      server.on("request", (req, res) => {
        const query = new URLSearchParams(req.url!.split("?")[1]);
        const access_token = query.get("accessToken");
        const returnedNonce = query.get("nonce")!;

        if (!access_token) {
          reject(new Error("No token"));
          return;
        }
        if (!nonce) {
          reject(new Error("No nonce"));
          return;
        }

        // Check if it is a valid auth request started by the extension
        if (nonce !== returnedNonce) {
          reject(new Error("Nonce does not match"));
          return;
        }

        resolve(access_token);
        res.end("You are logged into Pulumi Cloud. You can now close this tab.");
        server.close();
      });

    });
    const timeoutMilliseconds = 1000 * 60 * 2;
    server.listen(0, async () => {
      console.log(`Server listening on ${server.address()?.toString()}`);
    });

    const address = server.address();
    const port = (address && typeof address !== 'string') ? address.port : 0;

    const tokenDescription = `Generated by vscode login at ${new Date().toISOString()}`;
    const searchParams = new URLSearchParams([
      ["cliSessionPort", port.toString()],
      ["cliSessionNonce", nonce],
      ["cliSessionDescription", tokenDescription],
      ["cliCommand", "vscode-pulumi"],
    ]);
    const uri = vscode.Uri.parse(
      `${cli.consoleUrl()}/cli-login?${searchParams.toString()}`
    );

    const allowed = await vscode.env.openExternal(uri);
    if (!allowed) {
      return "";
    }

    const timeout = new Promise<string>((_, reject) => setTimeout(() => {
      server.close();
      reject('Cancelled');
    }, timeoutMilliseconds));

    return await Promise.race([
      promise,
      timeout,
      promiseFromEvent<any, any>(cancellationToken.onCancellationRequested, (_, __, reject) => { reject('User Cancelled'); }).promise
    ]);
  }

  /**
   * Dispose the registered services
   */
  public async dispose() {
    this._disposable.dispose();
  }
}
