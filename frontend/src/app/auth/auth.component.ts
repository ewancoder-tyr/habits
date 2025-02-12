import { ChangeDetectionStrategy, Component, effect, ElementRef, HostListener, signal, ViewChild } from '@angular/core';
import { initializeGoogleAuth } from '../google-auth';
import { AuthService } from '../auth.service';

@Component({
    selector: 'hab-auth',
    imports: [],
    templateUrl: './auth.component.html',
    styleUrl: './auth.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthComponent {
    @ViewChild('auth') authElement!: ElementRef<HTMLDivElement>;
    @HostListener('window:load')
    async onLoad() {
        initializeGoogleAuth(this.authElement.nativeElement);
    }

    constructor(protected auth: AuthService) {
        effect(() => {
            if (auth.needsAuthSignal()) this.auth.getToken();
        });
    }
}
