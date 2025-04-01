import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { AuthService } from './auth.service';
import { ModeSelectorComponent } from './mode-selector/mode-selector.component';
import { StreaksService } from './streaks.service';
import { ThemeService } from './theme.service';
import { ModeService } from './state-management/mode.service';
import { Mode } from './state-management/mode.service';

@Component({
    selector: 'hab-root',
    imports: [RouterOutlet, AuthComponent, ModeSelectorComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
    constructor(
        protected auth: AuthService,
        protected streaksService: StreaksService,
        protected themeService: ThemeService,
        protected modeService: ModeService
    ) {}

    resetMode() {
        this.modeService.setMode(Mode.Unset);
    }
}
