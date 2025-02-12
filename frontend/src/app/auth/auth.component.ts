import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { initializeGoogleAuth } from '../google-auth';

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
    onLoad() {
        initializeGoogleAuth(this.authElement.nativeElement);
    }
}
