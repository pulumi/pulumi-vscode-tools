import axios, { AxiosResponse, AxiosInstance } from 'axios';
import * as config from './config';
import * as models from './models';

const packageJSON = require("../../package.json");

export default class EscApi {
    private token: string | undefined;
    constructor(token: string | undefined = undefined) {
        this.token = token;
    }

    async listAllReferrers(org: string, project: string, envName: string, version?: string): Promise<models.EnvironmentImportReferrer[]> {
        let nextToken : string | undefined = undefined;
        version = version || "latest";
        const referrers: models.EnvironmentImportReferrer[] = [];
        do {
            let url = `/api/esc/environments/${org}/${project}/${envName}/versions/${version}/referrers`;
            if (nextToken !== undefined) {
                url = `${url}?continuationToken=${nextToken}`;
            }
            const data = await this.get(url, "Failed to list referrers");
            const imports = data.referrers.filter(ref => ref.environment !== undefined).map(ref => ref.environment);
            referrers.push(...imports);

            nextToken = data.nextToken;
        } while (nextToken !== undefined);

        return referrers;
    }

    async listProviders(): Promise<string[]> {
        const data = await this.get(`/api/esc/providers`, "Failed to list providers");
        return data.providers;
    }

    async getProviderSchema(provider: string): Promise<models.ProviderSchema> {
        const data = await this.get(`/api/esc/providers/${provider}/schema`, "Failed to get provider schema");
        return data;
    }

    async getUserInfo(): Promise<models.User> {
        const data = await this.get(`/api/user`, "Failed to get user");
        return data;
    }

    async listAllEnvironments(org: string): Promise<models.OrgEnvironment[]> {
        let nextToken : string | undefined = undefined;
        const environments: models.OrgEnvironment[] = [];
        do {
            let url = `/api/esc/environments/${org}`;
            if (nextToken !== undefined) {
                url = `${url}?continuationToken=${nextToken}`;
            }
            const data = await this.get(url, "Failed to list environments");
            environments.push(...data.environments);

            nextToken = data.nextToken;
        } while (nextToken !== undefined);

        return environments;
    }

    async listRevisions(org: string, project: string, envName: string): Promise<models.EnvironmentRevision[]> {
        const data = await this.get(`/api/esc/environments/${org}/${project}/${envName}/versions`, "Failed to list revisions");
        return data;
    }

    async listTags(org: string, project: string, envName: string): Promise<models.Tag[]> {
        const data = await this.get(`/api/esc/environments/${org}/${project}/${envName}/versions/tags`, "Failed to list tags");
        return data.tags;
    }

    async getEnvironment(org: string, project: string, envName: string): Promise<string> {
        const data = await this.get(`/api/esc/environments/${org}/${project}/${envName}`, "Failed to get environment yaml");
        return data;
    }

    async getEnvironmentRevision(org: string, project: string, envName: string, version: string): Promise<string> {
        const data = await this.get(`/api/esc/environments/${org}/${project}/${envName}/versions/${version}`, "Failed to get environment revision yaml");
        return data;
    }

    async decryptEnvironment(org: string, project: string, envName: string): Promise<string> {
        const data = await this.get(`/api/esc/environments/${org}/${project}/${envName}/decrypt`, "Failed to decrypt environment yaml");
        return data;
    }

    async openEnvironment(org: string, project: string, envName: string) {
        const openInfo = await this.post(`/api/esc/environments/${org}/${project}/${envName}/open`, "", "Failed to open environment");

        if (!openInfo.id) {
            throw new Error("Failed to open environment");
        }

        const data = await this.get(`/api/esc/environments/${org}/${project}/${envName}/open/${openInfo.id}`, "Failed to open environment");
        return data;
    }


    async tagRevision(org: string, project: string, envName: string, tagName:string, revision: number): Promise<string> {
        const payload = {
            name: tagName,
            revision: revision,
        };

        const body = JSON.stringify(payload);
        const data = await this.post(`/api/esc/environments/${org}/${project}/${envName}/versions/tags`, body, "Failed to tag revision");
        return data;
    }

    async createEnvironment(org: string, project: string, envName: string): Promise<string> {
        const body = JSON.stringify({
            project: project,
            name: envName,
        });
        const data = await this.post(`/api/esc/environments/${org}`, body, "Failed to create environment");
        return data;
    }

    async checkEnvironment(org: string, project: string, envName: string, version?: string): Promise<models.CheckEnvironment> {
        try {
            version = version || "latest";
            const url = `/api/esc/environments/${org}/${project}/${envName}/versions/${version}/check`;
            const response = await this.post(url, "", "Failed to check environment");
            return response;
        } catch (err: any) {
            if (err instanceof axios.AxiosError) {
                if (err.response?.status === 400) {
                    return err.response.data;
                }
            }

            throw new Error("Failed to check environment");
        }
    }

    async checkEnvironmentYaml(org: string, definition: string): Promise<models.CheckEnvironment> {
        try {
            const request = await this.createRequest();
            const response = await request.post(`/api/esc/environments/${org}/yaml/check`, definition);
            return response.data;
        } catch (err: any) {
            if (err instanceof axios.AxiosError) {
                if (err.response?.status === 400) {
                    return err.response.data;
                }
            }

            throw new Error("Failed to check environment");
        }
    }

    async patchEnvironment(org: string, project: string, envName: string, content: string): Promise<string> {
        const data = await this.patch(`/api/esc/environments/${org}/${project}/${envName}`, content, "Failed to update environment");
        return data;
    }

    async deleteEnvironment(org: string, project: string, envName: string) {
        await this.delete(`/api/esc/environments/${org}/${project}/${envName}`, "Failed to delete environment");
    }

    async environmentExists(org: string, project: string, envName: string): Promise<boolean> {
        try {
            const request = await this.createRequest();
            await request.head(`/api/esc/environments/${org}/${project}/${envName}`);
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

    private async post(path: string, content: string = "", errorDescription: string) {
        try {
            const request = await this.createRequest();
            const response = await request.post(path, content);
            return response.data;
        } catch (err: any) {
            throw new Error(errorDescription);
        }
    }

    private async head(path: string, errorDescription: string): Promise<AxiosResponse<any, any>> {
        try {
            const request = await this.createRequest();
            const response = await request.head(path);
            return response;
        } catch (err: any) {
            throw new Error(errorDescription);
        }
    }

    async createRequest(): Promise<AxiosInstance> {
        let token = this.token;
        if (!token) {
            token = await config.authToken();
        }

        return axios.create({
            baseURL: config.apiUrl(),
            headers: {
                "User-Agent": `vscode/${packageJSON.version}`,
                "X-Pulumi-Source": "vscode",
                Authorization: `token ${token}`,
            }
        });
    }
}

