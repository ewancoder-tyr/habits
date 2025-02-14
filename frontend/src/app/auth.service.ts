import { Injectable, signal, WritableSignal } from '@angular/core';
import { createLock } from './lib';

let _getToken: (() => Promise<string>) | undefined = undefined;
export function setupAuth(getToken: () => Promise<string>) {
    _getToken = getToken;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private token: string = '';
    private lock = createLock();

    public needsAuthSignal: WritableSignal<boolean> = signal(true);
    public picture: string | undefined;

    public async getToken(): Promise<string> {
        if (!this.needsAuthSignal()) {
            return this.token;
        }

        await this.lock.wait();
        try {
            if (!this.needsAuthSignal()) {
                console.log('Returned cached token after waiting for a lock.');
                return this.token;
            }

            if (!_getToken) throw new Error('Authentication function is not initialized.');

            this.token = await _getToken();
            this.needsAuthSignal.set(false);

            setTimeout(() => {
                this.needsAuthSignal.set(true);
            }, this.getMsTillAuthenticationIsRequired(this.token));

            this.picture = this.parseJwt(this.token).picture;

            return this.token;
        } finally {
            this.lock.release();
        }
    }

    private getMsTillAuthenticationIsRequired(token: string) {
        return this.getExpiration(token) * 1000 - Date.now() - 60 * 5 * 1000;
    }

    private getExpiration(token: string) {
        return this.parseJwt(token).exp;
    }

    private parseJwt(token: string) {
        return JSON.parse(atob(token.split('.')[1]));
    }
}
