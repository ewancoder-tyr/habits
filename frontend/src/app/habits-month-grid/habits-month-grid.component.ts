import { ChangeDetectionStrategy, Component, computed, Input, OnInit, signal, Signal } from '@angular/core';
import { StreaksService } from '../streaks.service';
import { StreakDay } from '../streak-day/streak-day.component';
import { StreakLineComponent } from '../streak-line/streak-line.component';
import { SelectedMonth } from '../streaks/streaks.component';

@Component({
    selector: 'hab-habits-month-grid',
    imports: [StreakLineComponent],
    templateUrl: './habits-month-grid.component.html',
    styleUrl: './habits-month-grid.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HabitsMonthGridComponent implements OnInit {
    private order: Record<string, number> = {};
    protected daysSignal!: Signal<[string, StreakDay[]][]>;
    @Input() month: Signal<SelectedMonth> = signal({
        year: new Date().getFullYear(),
        month: new Date().getMonth()
    });
    @Input({ required: true }) group!: string | undefined;

    constructor(private service: StreaksService) {}

    ngOnInit() {
        this.daysSignal = computed(() => {
            const selectedMonth = this.month();
            const entries = Object.entries(
                this.service.getMonthDaysSignal(selectedMonth.year, selectedMonth.month, this.group)()
            );

            if (Object.keys(this.order).length !== Object.keys(entries).length) {
                this.order = {};
                let i = 0;
                for (const [habit] of entries) {
                    i++;
                    this.order[habit] = i;
                }
            }

            return entries.sort(([a], [b]) => this.order[a] - this.order[b]);
        });
    }

    protected updateHabit(habit: string) {
        const newName = prompt('New name for the habit:');
        const newDays = prompt('New length:');
        let group: string | null | undefined = prompt('Group:');
        if (group === '' || group === null) group = undefined;

        if (newName === 'delete' && newDays === 'delete' && group === 'delete') {
            this.service.removeHabit(habit);
            return;
        }

        if (newName && newDays) {
            this.service.updateHabit(habit, {
                name: newName,
                lengthDays: +newDays,
                group: group
            });
        }
    }
}
