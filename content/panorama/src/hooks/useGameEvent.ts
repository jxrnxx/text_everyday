import { useEffect } from 'react';

export function useGameEvent<T extends keyof CustomGameEventDeclarations>(
    eventName: T,
    callback: (event: CustomGameEventDeclarations[T]) => void,
    dependencies: React.DependencyList = []
) {
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const id = GameEvents.Subscribe(eventName, callback as any);
        return () => {
            GameEvents.Unsubscribe(id);
        };
    }, dependencies);
}
