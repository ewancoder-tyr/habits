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
        if (this.checkCookie()) {
            this.needsAuthSignal.set(false);
            console.log('cookie is found, using it for auth');
            this.picture = this.getPictureFromCookie(); // TODO: Do not read it every time we need a token.
            console.log('using picture from info cookie', this.picture);
            return '';
        } else if (!this.token) {
            console.log('cookie is not found and token is empty. getting the token');
            this.needsAuthSignal.set(true);
        }

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
                if (this.checkCookie()) {
                    console.log('token has expired but cookie is present. continuing using the cookie.');
                    this.token = ''; // Make sure when cookie expires we get a new token.
                } else {
                    console.log('token has expired and cookie too. notifying that we need to authenticate again.');
                    this.needsAuthSignal.set(true);
                    this.token = '';
                }
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

    private checkCookie() {
        const cookie = document.cookie
            .split(';')
            .map(x => x.trim())
            .find(cookie => cookie.startsWith('HabitsAuthSessionInfo='));

        if (!cookie) return cookie;

        const expiration = decodeURIComponent(cookie.replace('HabitsAuthSessionInfo=', '')).split('|')[0];
        return new Date(Date.parse(expiration)) > new Date();
    }

    private getPictureFromCookie() {
        const cookie = document.cookie
            .split(';')
            .map(x => x.trim())
            .find(cookie => cookie.startsWith('HabitsAuthSessionInfo='));

        if (cookie) {
            return decodeURIComponent(cookie.replace('HabitsAuthSessionInfo=', '')).split('|')[1];
        } else return undefined;
    }
}
