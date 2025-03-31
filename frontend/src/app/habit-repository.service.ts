import { HttpClient, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { computed, effect, inject, Injectable, Signal, signal } from '@angular/core';
import { BehaviorSubject, Observable, of, switchMap, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

export interface Habit {
    name: string;
    group?: string;
    lengthDays: number;
    days: number[];
}

interface CreateHabit {
    name: string;
    group?: string;
    lengthDays: number;
}

export interface UpdateHabit {
    name: string;
    group?: string;
    lengthDays: number;
}

export function httpInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
    const tokenPromise = inject(AuthService).getToken();
    const tokenObservable = fromPromise(tokenPromise);

    console.log('HTTP interceptor working.');

    return tokenObservable.pipe(
        switchMap(token => {
            const newReq = req.clone({
                headers: req.headers.append('Authorization', `Bearer ${token}`),
                withCredentials: true
            });

            return next(newReq);
        })
    );
}

interface IHabitRepository {
    getAll(): Observable<Habit[]>;
    create(createHabit: CreateHabit): Observable<Habit>;
    update(habitId: string, updateHabit: UpdateHabit): Observable<Habit>;
    markDay(habitId: string, day: number): Observable<Habit>;
    unmarkDay(habitId: string, day: number): Observable<Habit>;
    remove(habitId: string): Observable<void>;
}

@Injectable({ providedIn: 'root' })
class LocalHabitRepository implements IHabitRepository {
    private localStorageKey = 'tyr_habits_data';

    getAll(): Observable<Habit[]> {
        const data = this.getData();

        return of(data);
    }

    create(createHabit: CreateHabit): Observable<Habit> {
        const data = this.getData();

        if (data.find(habit => habit.name === createHabit.name)) {
            throw new Error('Habit with this name already exists.');
        }

        const habit: Habit = {
            name: createHabit.name,
            group: createHabit.group,
            lengthDays: createHabit.lengthDays,
            days: []
        };

        data.push(habit);
        this.saveData(data);
        console.log(data);

        return of(habit);
    }

    update(habitId: string, updateHabit: UpdateHabit): Observable<Habit> {
        const data = this.getData();
        const habits = data.filter(habit => habit.name === habitId);
        if (habits.length !== 1) throw new Error('Habit with this Id was not found or multiple habits found.');
        const habit = habits[0];

        habit.name = updateHabit.name;
        habit.group = updateHabit.group;
        habit.lengthDays = updateHabit.lengthDays;

        this.saveData(data);
        return of(habit);
    }

    markDay(habitId: string, day: number): Observable<Habit> {
        const data = this.getData();
        const habits = data.filter(habit => habit.name === habitId);
        if (habits.length !== 1) throw new Error('Habit with this Id was not found or multiple habits found.');
        const habit = habits[0];

        habit.days.push(day);

        this.saveData(data);
        return of(habit);
    }

    unmarkDay(habitId: string, day: number): Observable<Habit> {
        const data = this.getData();
        const habits = data.filter(habit => habit.name === habitId);
        if (habits.length !== 1) throw new Error('Habit with this Id was not found or multiple habits found.');
        const habit = habits[0];

        const index = habit.days.lastIndexOf(day);
        if (index !== -1) habit.days.splice(index, 1);

        this.saveData(data);
        return of(habit);
    }

    remove(habitId: string): Observable<void> {
        const data = this.getData();
        const habits = data.filter(habit => habit.name === habitId);
        if (habits.length !== 1) throw new Error('Habit with this Id was not found or multiple habits found.');

        const index = data.indexOf(habits[0]);
        data.splice(index, 1);

        this.saveData(data);
        return of(undefined);
    }

    private getData(): Habit[] {
        const data = localStorage.getItem(this.localStorageKey) ?? '[]';
        const parsed = JSON.parse(data) as Habit[];
        return parsed;
    }

    private saveData(habits: Habit[]) {
        const json = JSON.stringify(habits);
        localStorage.setItem(this.localStorageKey, json);
    }
}

@Injectable({ providedIn: 'root' })
class ApiHabitRepository implements IHabitRepository {
    private habitsUri = 'https://api.habits.typingrealm.com/api/habits';
    constructor(private http: HttpClient) {}

    getAll(): Observable<Habit[]> {
        return this.http.get<Habit[]>(this.habitsUri);
    }

    create(createHabit: CreateHabit): Observable<Habit> {
        return this.http
            .post<HabitCreated>(this.habitsUri, createHabit)
            .pipe(switchMap(habitCreated => this.http.get<Habit>(`${this.habitsUri}/${habitCreated.id}`)));
    }

    update(habitId: string, updateHabit: UpdateHabit): Observable<Habit> {
        return this.http.put<Habit>(`${this.habitsUri}/${habitId}`, updateHabit);
    }

    markDay(habitId: string, day: number): Observable<Habit> {
        return this.http.post<Habit>(`${this.habitsUri}/${habitId}/days/${day}`, null);
    }

    unmarkDay(habitId: string, day: number): Observable<Habit> {
        return this.http.delete<Habit>(`${this.habitsUri}/${habitId}/days/${day}`);
    }

    remove(habitId: string): Observable<void> {
        return this.http.delete<void>(`${this.habitsUri}/${habitId}`);
    }
}

interface IHabitRepositoryFactory {
    createRepo(): IHabitRepository;
}

interface HabitCreated {
    id: string;
}

export enum Mode {
    Unset = 0,
    Local = 1,
    Server = 2
}

@Injectable({ providedIn: 'root' })
export class ModeService {
    private key = 'tyr_habits_mode';
    modeSignal = signal(Mode.Unset);

    constructor() {
        const mode = this.getMode();
        this.modeSignal.set(mode);
    }

    private getMode() {
        console.log('Getting the mode.');
        const mode = localStorage.getItem(this.key);
        if (mode === 'local') return Mode.Local;
        if (mode === 'server') return Mode.Server;
        return Mode.Unset;
    }

    setMode(mode: Mode) {
        let modeString = 'unset';
        if (mode === Mode.Local) modeString = 'local';
        if (mode === Mode.Server) modeString = 'server';
        localStorage.setItem(this.key, modeString);
        this.modeSignal.set(mode);
    }
}

// A hacky way to make it work for now.
class DoNothingRepo implements IHabitRepository {
    getAll(): Observable<Habit[]> {
        return of([]);
    }
    create(createHabit: CreateHabit): Observable<Habit> {
        return of<Habit>(undefined!);
    }
    update(habitId: string, updateHabit: UpdateHabit): Observable<Habit> {
        return of<Habit>(undefined!);
    }
    markDay(habitId: string, day: number): Observable<Habit> {
        return of<Habit>(undefined!);
    }
    unmarkDay(habitId: string, day: number): Observable<Habit> {
        return of<Habit>(undefined!);
    }
    remove(habitId: string): Observable<void> {
        return of();
    }
}

@Injectable({ providedIn: 'root' })
class HabitRepositoryFactory {
    repoSignal: Signal<IHabitRepository>;

    constructor(
        private modeService: ModeService,
        private localRepo: LocalHabitRepository,
        private apiRepo: ApiHabitRepository
    ) {
        this.repoSignal = computed(() => {
            const mode = this.modeService.modeSignal();
            if (mode === Mode.Server) return this.apiRepo;
            if (mode === Mode.Local) return this.localRepo;

            console.log('Mode is not selected yet, doing nothing.');
            return new DoNothingRepo();
        });
    }
}

@Injectable({ providedIn: 'root' })
export class CachedHabitRepository implements IHabitRepository {
    private data = new BehaviorSubject<Habit[]>([]);
    private repo: IHabitRepository;

    constructor(repoFactory: HabitRepositoryFactory) {
        this.repo = repoFactory.repoSignal();
        effect(() => {
            console.log('Resetting the data. Got a new repository.');
            this.data.next([]);
            this.repo = repoFactory.repoSignal();

            // Re-trigger getting all the data.
            this.getData().subscribe();
        });
    }

    getAll(): Observable<Habit[]> {
        console.log('Getting all habits observable.');
        return this.getData().pipe(switchMap(() => this.data.asObservable()));
    }

    create(createHabit: CreateHabit): Observable<Habit> {
        return this.getData().pipe(
            switchMap(() => this.repo.create(createHabit)),
            tap(habit => this.addHabit(habit))
        );
    }

    update(habitId: string, updateHabit: UpdateHabit): Observable<Habit> {
        return this.getData().pipe(
            switchMap(() => this.repo.update(habitId, updateHabit)),
            tap(habit => this.updateHabit(habitId, habit))
        );
    }

    markDay(habitId: string, day: number): Observable<Habit> {
        return this.getData().pipe(
            switchMap(() => this.repo.markDay(habitId, day)),
            tap(habit => this.updateHabit(habitId, habit))
        );
    }

    unmarkDay(habitId: string, day: number): Observable<Habit> {
        return this.getData().pipe(
            switchMap(() => this.repo.unmarkDay(habitId, day)),
            tap(habit => this.updateHabit(habitId, habit))
        );
    }

    remove(habitId: string): Observable<void> {
        return this.getData().pipe(
            switchMap(() => this.repo.remove(habitId)),
            tap(() => this.deleteHabit(habitId))
        );
    }

    private getData(): Observable<Habit[]> {
        if (this.data.value.length > 0) return of(this.data.value);

        return this.repo.getAll().pipe(
            tap(data => {
                console.log('Retrieved ALL data from Repository', data);
                this.data.next(data);
            })
        );
    }

    private addHabit(habit: Habit) {
        this.data.value.push(habit);
        this.data.next(this.data.value);
    }

    private deleteHabit(habitId: string) {
        const existing = this.data.value.find(h => h.name === habitId);
        if (existing) {
            const index = this.data.value.indexOf(existing);
            if (index !== -1) {
                this.data.value.splice(index, 1);
                this.data.next(this.data.value);
            }
        }
    }

    private updateHabit(habitId: string, habit: Habit) {
        console.log(this.data.value);
        const existing = this.data.value.find(h => h.name === habitId);
        if (!existing) throw new Error('Existing habit not found.');

        this.data.value.splice(this.data.value.indexOf(existing), 1);
        this.data.value.push(habit);
        this.data.next(this.data.value);
    }
}
