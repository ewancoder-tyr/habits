import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DayInfo, DayStatus, StreaksService } from '../streaks.service';
import { ThemeService } from '../theme.service';

@Component({
    selector: 'hab-streak-day',
    imports: [],
    templateUrl: './streak-day.component.html',
    styleUrl: './streak-day.component.scss',
    host: {
        '[class]': 'getClass()',
        '(click)': 'toggle(this.day)',
        '[class.today]': 'day.isToday',
        '(contextmenu)': 'untoggle(this.day, $event)'
    },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StreakDayComponent {
    @Input({ required: true }) day!: StreakDay;

    constructor(
        private service: StreaksService,
        protected themeService: ThemeService
    ) {}

    protected toggle(day: StreakDay) {
        if (day.info.timesNeeded > 1) {
            console.log('test');
            this.service.mark(day);
            return;
        }

        if (day.info.status === 1) {
            this.service.unmark(day);
        } else {
            this.service.mark(day);
        }
    }

    protected untoggle(day: StreakDay, event: any) {
        event.preventDefault();
        if (day.info.timesNeeded <= 1) return;

        this.service.unmark(day);
    }

    protected getClass() {
        return this.getMarkedClass();
    }

    protected getMarkedClass() {
        switch (this.day.info.status) {
            case DayStatus.Successful:
                return 'marked';
            case DayStatus.Inherited:
                return 'marked-light';
            default:
                return undefined;
        }
    }
}

export interface StreakDay {
    id: number;
    day: number;
    info: DayInfo;
    habit: string;
    isToday?: boolean;
}
