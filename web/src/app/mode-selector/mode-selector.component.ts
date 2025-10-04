import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StreaksService } from '../streaks.service';
import { ModeService } from '../state-management/mode.service';
import { Mode } from '../state-management/mode.service';

@Component({
    selector: 'hab-mode-selector',
    imports: [],
    templateUrl: './mode-selector.component.html',
    styleUrl: './mode-selector.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModeSelectorComponent {
    constructor(private modeService: ModeService) {}

    protected selectLocal() {
        this.modeService.setMode(Mode.Local);
    }

    protected selectApi() {
        this.modeService.setMode(Mode.Server);
    }
}
