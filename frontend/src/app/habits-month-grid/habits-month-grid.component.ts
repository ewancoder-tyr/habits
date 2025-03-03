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
    protected monthNameSignal!: Signal<string>;
    @Input() month: Signal<SelectedMonth> = signal({
        year: new Date().getFullYear(),
        month: new Date().getMonth()
    });

    constructor(private service: StreaksService) {}

    ngOnInit() {
        this.daysSignal = computed(() => {
            const selectedMonth = this.month();
            const entries = Object.entries(this.service.getMonthDaysSignal(selectedMonth.year, selectedMonth.month)());

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
        this.monthNameSignal = computed(() => {
            const selectedMonth = this.month();
            return new Date(selectedMonth.year, selectedMonth.month, 5).toLocaleString('en-US', {
                month: 'long',
                year: 'numeric'
            });
        });
    }

    protected updateHabit(habit: string) {
        const newName = prompt('New name for the habit:');
        const newDays = prompt('New length:');

        if (newName === 'delete' && newDays === 'delete') {
            this.service.removeHabit(habit);
            return;
        }

        if (newName && newDays) {
            this.service.updateHabit(habit, {
                name: newName,
                lengthDays: +newDays
            });
        }
    }
}
