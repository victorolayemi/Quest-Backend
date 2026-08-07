import { importPKCS8, SignJWT } from 'jose';

export class FCMService {
  clientEmail: string;
  privateKey: string;
  projectId: string;
  accessToken: string | null = null;
  tokenExpiration: number = 0;

  constructor(clientEmail: string, privateKey: string) {
    this.clientEmail = clientEmail;
    
    // Sanitize private key: handle escaped newlines, trim, and remove wrapping quotes
    let formattedKey = privateKey.replace(/\\n/g, '\n').trim();
    if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
      formattedKey = formattedKey.substring(1, formattedKey.length - 1).replace(/\\n/g, '\n');
    }
    if (formattedKey.startsWith("'") && formattedKey.endsWith("'")) {
      formattedKey = formattedKey.substring(1, formattedKey.length - 1).replace(/\\n/g, '\n');
    }
    this.privateKey = formattedKey;

    const match2 = this.clientEmail.match(/@([^.]+)\.iam\.gserviceaccount\.com/);
    if (!match2) {
      throw new Error("Invalid FIREBASE_CLIENT_EMAIL format. Cannot extract project ID.");
    }
    this.projectId = match2[1];
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiration) {
      return this.accessToken;
    }
    const alg = "RS256";
    const privateKeyObj = await importPKCS8(this.privateKey, alg);
    const now = Math.floor(Date.now() / 1e3);
    const expire = now + 3600;
    const jwt2 = await new SignJWT({
      iss: this.clientEmail,
      sub: this.clientEmail,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/firebase.messaging"
    }).setProtectedHeader({ alg, typ: "JWT" }).setIssuedAt(now).setExpirationTime(expire).sign(privateKeyObj);
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt2
      })
    });
    if (!response.ok) {
      const err2 = await response.text();
      throw new Error(`Failed to get OAuth token: ${err2}`);
    }
    const data: any = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiration = Date.now() + (data.expires_in - 300) * 1e3;
    return this.accessToken as string;
  }

  async sendNotification(message2: any) {
    const token = await this.getAccessToken();
    const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message2
      })
    });
    if (!response.ok) {
      const err2 = await response.text();
      console.error(`Failed to send FCM notification: ${err2}`);
      throw new Error(`Failed to send FCM notification: ${err2}`);
    }
  }
}
