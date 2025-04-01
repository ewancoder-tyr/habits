import { Injectable, signal } from '@angular/core';

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
