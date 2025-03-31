import { ChangeDetectionStrategy, Component, effect, ElementRef, HostListener, signal, ViewChild } from '@angular/core';
import { initializeGoogleAuth } from '../google-auth';
import { AuthService } from '../auth.service';
import { Mode, ModeService } from '../habit-repository.service';

@Component({
    selector: 'hab-auth',
    imports: [],
    templateUrl: './auth.component.html',
    styleUrl: './auth.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class.hidden]': 'modeService.modeSignal() !== 2'
    }
})
export class AuthComponent {
    @ViewChild('authElement') authElement!: ElementRef<HTMLDivElement>;
    @HostListener('window:load')
    async onLoad() {
        initializeGoogleAuth(this.authElement.nativeElement);
    }

    constructor(
        protected auth: AuthService,
        protected modeService: ModeService
    ) {
        effect(() => {
            if (auth.needsAuthSignal() && modeService.modeSignal() === Mode.Server) this.auth.getToken();
        });
    }
}
