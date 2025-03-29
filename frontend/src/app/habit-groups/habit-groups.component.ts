import { Component, computed, Input, OnInit, Signal } from '@angular/core';
import { HabitsMonthGridComponent } from '../habits-month-grid/habits-month-grid.component';
import { SelectedMonth } from '../streaks/streaks.component';
import { HabitGroup } from '../streaks.service';

@Component({
    selector: 'hab-habit-groups',
    imports: [HabitsMonthGridComponent],
    templateUrl: './habit-groups.component.html',
    styleUrl: './habit-groups.component.scss'
})
export class HabitGroupsComponent implements OnInit {
    protected monthNameSignal!: Signal<string>;
    @Input({ required: true }) monthSignal!: Signal<SelectedMonth>;
    @Input({ required: true }) groupsSignal!: Signal<HabitGroup[]>;

    ngOnInit() {
        this.monthNameSignal = computed(() => {
            const selectedMonth = this.monthSignal();
            return new Date(selectedMonth.year, selectedMonth.month, 5).toLocaleString('en-US', {
                month: 'long',
                year: 'numeric'
            });
        });
    }
}
