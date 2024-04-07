
export async function backendUrl(): Promise<string> {
    return "https://api.pulumi.com";
} 

export async function authToken(): Promise<string> {
    return process.env.PULUMI_ACCESS_TOKEN || "";
}

export async function organization(): Promise<string> {
    return process.env.PULUMI_ORG || "";
}