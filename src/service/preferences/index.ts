export namespace preferences {

    interface KeyTypeMap {
        'map.camera.lng': number,
        'map.camera.lat': number,
        'map.camera.zoom': number,
        'map.camera.bearing': number,
        'map.camera.pitch': number,

        'panel.angle-diff-threshold': number,
        'panel.auto-confirm-next': boolean,
        'panel.satellite-layer-opacity': number,
    };

    type Key = keyof KeyTypeMap;

    export function set<K extends Key>(key: K, value: KeyTypeMap[K]) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    export function get<K extends Key>(key: K) : KeyTypeMap[K] | undefined {
        const value = localStorage.getItem(key);
        if (value === null) return undefined;
        return JSON.parse(value);
    }
}