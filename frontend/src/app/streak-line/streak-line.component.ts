import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { StreakDay, StreakDayComponent } from '../streak-day/streak-day.component';

@Component({
    selector: 'hab-streak-line',
    imports: [StreakDayComponent],
    templateUrl: './streak-line.component.html',
    styleUrl: './streak-line.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StreakLineComponent {
    @Input({ required: true }) days!: StreakDay[];
}
