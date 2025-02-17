import { setupAuth } from './auth.service';
import { ResolveStack } from './lib';

declare const google: any;
interface AuthResponse {
    credential: string;
}

let initializedPromiseResolve: (() => void) | undefined = undefined;
const initializedPromise = new Promise<void>(resolve => (initializedPromiseResolve = resolve));

export function initializeGoogleAuth(authElement: HTMLDivElement) {
    google.accounts.id.initialize({
        client_id: '400839590162-24pngke3ov8rbi2f3forabpaufaosldg.apps.googleusercontent.com',
        context: 'signin',
        ux_mode: 'popup',
        callback: authCallback,
        auto_select: true,
        itp_support: true,
        use_fedcm_for_prompt: true,
        cancel_on_tap_outside: false
    });

    google.accounts.id.renderButton(authElement, {
        type: 'standard',
        shape: 'rectangular',
        theme: 'outline',
        text: 'signin',
        size: 'large',
        logo_alignment: 'left'
    });

    if (initializedPromiseResolve) initializedPromiseResolve();
}

setupAuth(getToken);

const resolveStack = new ResolveStack<string>();
async function getToken(): Promise<string> {
    await initializedPromise;

    google.accounts.id.prompt();

    return await new Promise<string>(resolve => {
        resolveStack.add(resolve);
    });
}

async function authCallback(response: AuthResponse) {
    resolveStack.resolveAll(response.credential);
}
