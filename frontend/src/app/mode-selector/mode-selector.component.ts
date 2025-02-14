import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Mode, StreaksService } from '../streaks.service';

@Component({
    selector: 'hab-mode-selector',
    imports: [],
    templateUrl: './mode-selector.component.html',
    styleUrl: './mode-selector.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModeSelectorComponent {
    constructor(private streaksService: StreaksService) {}

    protected selectLocal() {
        this.streaksService.setMode(Mode.Local);
    }

    protected selectApi() {
        this.streaksService.setMode(Mode.Server);
    }
}
