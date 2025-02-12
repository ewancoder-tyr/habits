export interface Lock {
    wait: () => Promise<void>;
    release: () => void;
}

export function createLock(): Lock {
    let nextLock: Promise<void> | undefined = undefined;
    const resolves: (() => void)[] = [];

    return {
        wait: async function () {
            const lock = new Promise<void>(resolve => resolves.push(resolve));

            // TODO: These operations should be atomic.
            const thisLock = nextLock;
            nextLock = lock;
            await thisLock;
        },

        release: function () {
            const resolve = resolves.shift();
            if (resolve !== undefined) {
                resolve();
            }
        }
    };
}

export class ResolveStack<T> {
    private resolves: ((arg: T) => void)[] = [];

    add(resolve: (arg: T) => void) {
        this.resolves.push(resolve);
    }

    resolveAll(arg: T) {
        const copy = this.resolves;
        this.resolves = [];

        for (const resolve of copy) {
            resolve(arg);
        }
    }
}
