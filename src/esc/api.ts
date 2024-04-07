import * as vscode from 'vscode';
import axios from 'axios';
import * as cli from './cli';
import * as models from './models';

const packageJSON = require("../../package.json");

export default class EscApi {
    constructor(private readonly org: string) {
    }

    async listAllEnvironments(): Promise<models.OrgEnvironment[]> {
        let nextToken : string | undefined = undefined;
        const environments: models.OrgEnvironment[] = [];
        do {
            const data = await this.get(`/api/preview/environments/${this.org}`, "Failed to list environments");
            environments.push(...data.environments);

            nextToken = data.nextToken;
        } while (nextToken !== undefined);

        return environments;
    }

    async getEnvironment(envName: string): Promise<string> {
        const data = await this.get(`/api/preview/environments/${this.org}/${envName}`, "Failed to get environment yaml");
        return data;
    }

    async decryptEnvironment(envName: string): Promise<string> {
        const data = await this.get(`/api/preview/environments/${this.org}/${envName}/decrypt`, "Failed to decrypt environment yaml");
        return data;
    }

    async openEnvironment(envName: string) {
        const openInfo = await this.post(`/api/preview/environments/${this.org}/${envName}/open`, "Failed to open environment");

        if (!openInfo.id) {
            throw new Error("Failed to open environment");
        }

        const data = await this.get(`/api/preview/environments/${this.org}/${envName}/open/${openInfo.id}`, "Failed to open environment");
        return data;
    }

    async createEnvironment(envName: string): Promise<string> {
        const data = await this.post(`/api/preview/environments/${this.org}/${envName}`, "Failed to create environment");
        return data;
    }

    async patchEnvironment(envName: string, content: string): Promise<string> {
        const data = await this.patch(`/api/preview/environments/${this.org}/${envName}`, content, "Failed to update environment");
        return data;
    }

    async deleteEnvironment(envName: string) {
        await this.delete(`/api/preview/environments/${this.org}/${envName}`, "Failed to delete environment");
    }

    async environmentExists(envName: string): Promise<boolean> {
        try {
            const request = await this.createRequest();
            await request.head(`/api/preview/environments/${this.org}/${envName}`);
            return true;
        } catch (err: any) {
            if (err instanceof axios.AxiosError) {
                if (err.response?.status === 404) {
                    return false;
                }
            }

            throw err;
        }
    }


    private async delete(path: string, errorDescription: string) {
        try {
            const request = await this.createRequest();
            await request.delete(path);
        } catch (err: any) {
            throw new Error(errorDescription);
        }
    }

    private async get(path: string, errorDescription: string) {
        try {
            const request = await this.createRequest();
            const response = await request.get(path);
            return response.data;
        } catch (err: any) {
            throw new Error(errorDescription);
        }
    }

    private async patch(path: string, content: string, errorDescription: string) {
        try {
            const request = await this.createRequest();
            const response = await request.patch(path, content);
            return response.data;
        } catch (err: any) {
            throw new Error(errorDescription);
        }
    }

    private async post(path: string, errorDescription: string) {
        try {
            const request = await this.createRequest();
            const response = await request.post(path);
            return response.data;
        } catch (err: any) {
            throw new Error(errorDescription);
        }
    }

    private async head(path: string, errorDescription: string): Promise<axios.AxiosResponse<any, any>> {
        try {
            const request = await this.createRequest();
            const response = await request.head(path);
            return response;
        } catch (err: any) {
            throw new Error(errorDescription);
        }
    }

    async createRequest(): Promise<axios.AxiosInstance> {
        return axios.create({
            baseURL: await cli.backendUrl(),
            headers: {
                "User-Agent": `vscode/${packageJSON.version}`,
                "X-Pulumi-Source": "vscode",
                Authorization: `token ${await cli.authToken()}`,
            }
        });
    }
}

