import { computed, Injectable, signal } from '@angular/core';
import { StreakDay } from './streak-day/streak-day.component';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { BehaviorSubject, flatMap, from, map, mergeMap, Observable, of, Subscription, switchMap, tap } from 'rxjs';

interface IHabitStreakRepository {
    data$: Observable<HabitStreakData[]>;

    initialize(): Observable<HabitStreakData[]>;
    create(habit: string, length: number): Observable<HabitStreakData>;
    update(habitId: string, habit: UpdateHabit): Observable<HabitStreakData>;
    markDay(habit: string, day: number): Observable<HabitStreakData>;
    unmarkDay(habit: string, day: number): Observable<HabitStreakData>;
    remove(habit: string): Observable<void>;
}

export enum Mode {
    Unset = 0,
    Local = 1,
    Server = 2
}

@Injectable({ providedIn: 'root' })
class LocalHabitStreakRepository implements IHabitStreakRepository {
    private localStorageKey = 'ewancoder_streaks_data';

    private readonly data = new BehaviorSubject<HabitStreakData[]>([]);
    get data$(): Observable<HabitStreakData[]> {
        return this.data.asObservable();
    }

    initialize(): Observable<HabitStreakData[]> {
        const data = localStorage.getItem(this.localStorageKey) ?? '[]';
        const parsed = JSON.parse(data) as HabitStreakData[];
        this.data.next(parsed);
        return of(parsed);
    }

    update(habitId: string, habit: UpdateHabit): Observable<HabitStreakData> {
        const found = this.data.value.find(s => s.name === habitId);
        if (!found) throw new Error('Habit for the update was not found.');

        found.name = habit.name;
        found.lengthDays = habit.lengthDays;

        this.saveData();
        return of(found);
    }

    markDay(habit: string, day: number): Observable<HabitStreakData> {
        const streak = this.data.value.find(s => s.name === habit);
        if (!streak) throw new Error('Streak for marking a day was not found.');

        streak.days.push(day);

        this.saveData();
        return of(streak);
    }

    unmarkDay(habit: string, day: number): Observable<HabitStreakData> {
        const streak = this.data.value.find(s => s.name === habit);
        if (!streak) throw new Error('Streak for marking a day was not found.');

        const found = streak.days.find(d => d === day);
        if (found) {
            streak.days.splice(streak.days.indexOf(found), 1);
        }

        this.saveData();
        return of(streak);
    }

    create(habit: string, length: number, habitGroup?: string): Observable<HabitStreakData> {
        const newHabit = {
            name: habit,
            group: habitGroup,
            lengthDays: length,
            days: []
        };
        this.data.value.push(newHabit);
        this.saveData();
        return of(newHabit);
    }

    remove(habit: string): Observable<void> {
        const streak = this.data.value.find(s => s.name === habit);
        if (!streak) throw new Error('Streak for marking a day was not found.');

        this.data.next(this.data.value.splice(this.data.value.indexOf(streak, 0), 1));
        this.saveData();
        return of();
    }

    private saveData() {
        localStorage.setItem(this.localStorageKey, JSON.stringify(this.data.value));
        this.data.next(this.data.value);
    }
}

@Injectable({ providedIn: 'root' })
class ApiHabitStreakRepository implements IHabitStreakRepository {
    private readonly data = new BehaviorSubject<HabitStreakData[]>([]);
    get data$(): Observable<HabitStreakData[]> {
        return this.data.asObservable();
    }

    constructor(
        private auth: AuthService,
        private http: HttpClient
    ) {}

    initialize(): Observable<HabitStreakData[]> {
        return from(this.auth.getToken()).pipe(
            switchMap(token =>
                this.http
                    .get<HabitStreakData[]>('https://api.habits.typingrealm.com/api/habits', {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        withCredentials: true
                    })
                    .pipe(
                        tap(habits => {
                            this.data.next(habits);
                        })
                    )
            )
        );
    }

    update(habitId: string, habit: UpdateHabit): Observable<HabitStreakData> {
        return from(this.auth.getToken()).pipe(
            switchMap(token =>
                this.http
                    .put<HabitStreakData>(`https://api.habits.typingrealm.com/api/habits/${habitId}`, habit, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        withCredentials: true
                    })
                    .pipe(
                        tap(habit => {
                            const existing = this.data.value.find(x => x.name == habitId);
                            this.data.value.splice(this.data.value.indexOf(existing!), 1);
                            this.data.value.push(habit);
                            this.data.next(this.data.value);
                        })
                    )
            )
        );
    }

    markDay(habit: string, day: number): Observable<HabitStreakData> {
        return from(this.auth.getToken()).pipe(
            switchMap(token =>
                this.http
                    .post<HabitStreakData>(`https://api.habits.typingrealm.com/api/habits/${habit}/days/${day}`, null, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        withCredentials: true
                    })
                    .pipe(
                        tap(habit => {
                            const existing = this.data.value.find(x => x.name == habit.name);
                            this.data.value.splice(this.data.value.indexOf(existing!), 1);
                            this.data.value.push(habit);
                            this.data.next(this.data.value);
                        })
                    )
            )
        );
    }

    unmarkDay(habit: string, day: number): Observable<HabitStreakData> {
        return from(this.auth.getToken()).pipe(
            switchMap(token =>
                this.http
                    .delete<HabitStreakData>(`https://api.habits.typingrealm.com/api/habits/${habit}/days/${day}`, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        withCredentials: true
                    })
                    .pipe(
                        tap(habit => {
                            const existing = this.data.value.find(x => x.name === habit.name);
                            this.data.value.splice(this.data.value.indexOf(existing!), 1);
                            this.data.value.push(habit);
                            this.data.next(this.data.value);
                        })
                    )
            )
        );
    }

    create(habit: string, length: number): Observable<HabitStreakData> {
        return from(this.auth.getToken()).pipe(
            switchMap(token =>
                this.http
                    .post<string>(
                        'https://api.habits.typingrealm.com/api/habits',
                        {
                            name: habit,
                            lengthDays: length
                        },
                        {
                            headers: {
                                Authorization: `Bearer ${token}`
                            },
                            withCredentials: true
                        }
                    )
                    .pipe(
                        switchMap((created: any) =>
                            this.http.get<HabitStreakData>(`https://api.habits.typingrealm.com/api/habits/${created.id}`, {
                                headers: {
                                    Authorization: `Bearer ${token}`
                                },
                                withCredentials: true
                            })
                        )
                    )
                    .pipe(
                        tap(habit => {
                            this.data.value.push(habit);
                            this.data.next(this.data.value);
                        })
                    )
            )
        );
    }

    remove(habit: string): Observable<void> {
        return from(this.auth.getToken()).pipe(
            switchMap(token =>
                this.http
                    .delete<void>(`https://api.habits.typingrealm.com/api/habits/${habit}`, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        withCredentials: true
                    })
                    .pipe(
                        switchMap(() =>
                            this.http.get<HabitStreakData[]>(`https://api.habits.typingrealm.com/api/habits`, {
                                headers: {
                                    Authorization: `Bearer ${token}`
                                },
                                withCredentials: true
                            })
                        )
                    )
                    .pipe(
                        tap(habits => {
                            this.data.next(habits);
                        }),
                        map(() => void 0)
                    )
            )
        );
    }
}

@Injectable({ providedIn: 'root' })
export class StreaksService {
    private earliestSupportedYear = 2020;
    public groupsSignal = signal<HabitGroup[]>([]);
    public streaksSignal = signal<HabitStreak[]>([]);

    private repo: IHabitStreakRepository | undefined;
    private subscription: Subscription | undefined;

    public modeSignal = signal<Mode>(Mode.Unset);

    constructor(
        private localRepo: LocalHabitStreakRepository,
        private apiRepo: ApiHabitStreakRepository,
        private auth: AuthService,
        private http: HttpClient
    ) {
        this.reloadDataSource();
    }

    private reloadDataSource() {
        this.repo = undefined;
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = undefined;
        }

        const mode = this.getMode();
        this.modeSignal.set(mode);
        if (mode === Mode.Server) this.repo = this.apiRepo;
        if (mode === Mode.Local) this.repo = this.localRepo;
        if (this.repo) {
            this.subscription = this.repo.data$.subscribe(streaks => this.recalculateStreaks(streaks));
            this.repo.initialize().subscribe();
        }
    }

    private getMode() {
        const mode = localStorage.getItem('ewancoder_habits_mode');
        if (mode === 'local') return Mode.Local;
        if (mode === 'server') return Mode.Server;
        return Mode.Unset;
    }

    public setMode(mode: Mode) {
        let modeString = 'unset';
        if (mode === Mode.Local) modeString = 'local';
        if (mode === Mode.Server) modeString = 'server';
        localStorage.setItem('ewancoder_habits_mode', modeString);

        this.reloadDataSource();
    }

    public updateHabit(id: string, update: UpdateHabit) {
        this.repo?.update(id, update).subscribe();
    }

    public mark(day: StreakDay) {
        this.repo?.markDay(day.habit, day.id).subscribe();
    }

    public unmark(day: StreakDay) {
        this.repo?.unmarkDay(day.habit, day.id).subscribe();
    }

    public createHabit(habit: string, length: number) {
        this.repo?.create(habit, length).subscribe();
    }

    public removeHabit(habit: string) {
        this.repo?.remove(habit).subscribe();
    }

    public getMonthDaysSignal(year: number, month: number, group?: string | null) {
        if (!group) group = null;
        const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth();
        const startingDayNumber = this.getStartingDayNumber(year, month);
        const daysAmount = this.getDaysInMonth(year, month);
        const monthDaysSignal = computed(() => {
            console.log(this.streaksSignal());
            console.log(this.groupsSignal());
            const data = this.groupsSignal().find(g => g.group === group)?.streaks ?? [];
            // TODO: throw an error when empty.

            const days: Record<string, StreakDay[]> = {};
            for (let i = 0; i < daysAmount; i++) {
                for (const habitData of data) {
                    if (!days[habitData.habit]) days[habitData.habit] = [];

                    const dayInfo = habitData.days[i + startingDayNumber] ?? {
                        status: DayStatus.Empty,
                        timesDone: 0,
                        timesNeeded: 0
                    };

                    const day: StreakDay = {
                        id: i + startingDayNumber,
                        day: i + 1,
                        habit: habitData.habit,
                        info: dayInfo
                    };

                    if (isCurrentMonth && i + 1 === new Date().getDate()) {
                        day.isToday = true;
                    }

                    days[habitData.habit].push(day);
                }
            }

            return days;
        });

        return monthDaysSignal;
    }

    private getStartingDayNumber(year: number, month: number): number {
        const additionalDaysFromYear =
            year === this.earliestSupportedYear
                ? 0
                : Array.from(Array(year - this.earliestSupportedYear).keys())
                      .map(x => x + this.earliestSupportedYear)
                      .map(year => this.getDaysInYear(year))
                      .reduce((partialSum, a) => partialSum + a, 0);

        const additionalDaysFromMonth =
            month === 0
                ? 0
                : Array.from(Array(month).keys())
                      .map(month => this.getDaysInMonth(year, month))
                      .reduce((partialSum, a) => partialSum + a, 0);

        return additionalDaysFromYear + additionalDaysFromMonth + 1;
    }

    private getDaysInYear(year: number): number {
        return (year % 4 === 0 && year % 100 > 0) || year % 400 == 0 ? 366 : 365;
    }

    private getDaysInMonth(year: number, month: number): number {
        return new Date(year, month + 1, 0).getDate();
    }

    private recalculateStreaks(streaks: HabitStreakData[]) {
        const calculated = streaks
            .map(streak => {
                const calculatedDays = this.calculateDays(streak.days, streak.lengthDays);
                return {
                    habit: streak.name,
                    days: calculatedDays.days,
                    order: calculatedDays.order,
                    group: streak.group
                };
            })
            .sort((a, b) => (a.order === b.order ? a.habit.localeCompare(b.habit) : a.order - b.order));

        const groups: HabitGroup[] = [];
        for (let streak of calculated) {
            console.log(streak.group);
            let group = groups.find(g => g.group === streak.group);
            if (!group) {
                group = {
                    group: streak.group,
                    streaks: []
                };
                groups.push(group);
            }

            group.streaks.push(streak);
        }

        this.streaksSignal.set(calculated);
        this.groupsSignal.set(
            groups.sort((a, b) => {
                const aS = a.group ? a.group : 'zzzzzz';
                const bS = b.group ? b.group : 'zzzzzz';

                return aS.localeCompare(bS);
            })
        );
    }

    private calculateDays(days: number[], lengthDays: number): { days: Record<number, DayInfo>; order: number } {
        const sortedDays = days.sort((a, b) => a - b);
        const resultDays: Record<number, DayInfo> = {};

        let order = 0;
        let timesNeeded = lengthDays > 1000 ? lengthDays - 1000 : 1;
        for (const day of sortedDays) {
            if (timesNeeded === 1) {
                order = day + lengthDays;
                resultDays[day] = {
                    status: DayStatus.Successful,
                    timesDone: 1,
                    timesNeeded: 1
                };

                for (let additionalDay = 1; additionalDay < lengthDays; additionalDay++) {
                    resultDays[day + additionalDay] = {
                        status: DayStatus.Inherited,
                        timesDone: 0,
                        timesNeeded: 0
                    };
                }
            } else {
                const result = resultDays[day] ?? {
                    status: DayStatus.Empty,
                    timesDone: 0,
                    timesNeeded: timesNeeded
                };

                result.timesDone++;
                if (result.timesDone >= result.timesNeeded) {
                    order = day + 1;
                    result.status = DayStatus.Successful;
                } else if (result.timesDone > 0) {
                    result.status = DayStatus.PartiallyMarked;
                }
                resultDays[day] = result;
            }
        }

        return { days: resultDays, order: order };
    }
}

export interface DayInfo {
    status: DayStatus;
    timesDone: number;
    timesNeeded: number;
}

export interface HabitStreak {
    habit: string;
    order: number;
    days: Record<number, DayInfo>;
}

export interface HabitGroup {
    group?: string;
    streaks: HabitStreak[];
}

export enum DayStatus {
    Empty = 0,
    Successful = 1,
    Inherited = 2,
    PartiallyMarked = 3
}

interface UpdateHabit {
    name: string;
    lengthDays: number;
    group: string | null;
}

interface HabitStreakData {
    name: string;
    group?: string;
    lengthDays: number;
    days: number[];
}
