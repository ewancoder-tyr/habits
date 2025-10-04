import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DayInfo, DayStatus, StreaksService } from '../streaks.service';
import { ThemeService } from '../theme.service';
import { CachedHabitRepository } from '../state-management/cached.habit.repository';

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
        private repo: CachedHabitRepository,
        protected themeService: ThemeService
    ) {}

    protected toggle(day: StreakDay) {
        if (day.info.timesNeeded > 1) {
            this.repo.markDay(day.habit, day.id).subscribe();
            return;
        }

        if (day.info.status === 1) {
            this.repo.unmarkDay(day.habit, day.id).subscribe();
        } else {
            this.repo.markDay(day.habit, day.id).subscribe();
        }
    }

    protected untoggle(day: StreakDay, event: any) {
        event.preventDefault();
        if (day.info.timesNeeded <= 1) return;

        this.repo.unmarkDay(day.habit, day.id).subscribe();
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
            case DayStatus.PartiallyMarked:
                return 'marked-partially';
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
