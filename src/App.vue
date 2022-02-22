<template>
<main>
    <trace-map ref="map"
        :focuse="focuse"
        :selection="selection"
        :trace="trace"
        :satellite-layer-opacity="satelliteLayerOpacity"
        @select="onSelect"
    />
    <panel
        :stage="stage"
        :trace="trace"
        v-model:angle-diff-threshold="angleDiffThreshold"
        v-model:auto-confirm-next="autoConfirmNext"
        v-model:satellite-layer-opacity="satelliteLayerOpacity"
        @command="onCommand"
    />
</main>
</template>

<script lang="ts">
import type mapboxgl from 'mapbox-gl';

import * as turf from '@turf/helpers';
import { eli } from '@lucka-labs/eli';
import { toKML } from '@placemarkio/tokml';
import { toRaw } from '@vue/reactivity';
import { Vue, Options, Ref, Watch } from 'vue-property-decorator';

import TraceMap, { TraceMapConstants } from '@/components/TraceMap.vue';
import Panel, { PanelCommand } from '@/components/Panel.vue';

import { algorithms } from '@/service/algorithms';
import { preferences } from '@/service/preferences';
import { Stage } from '@/service/stage';

@Options({
    components: {
        TraceMap, Panel
    }
})
export default class MainPage extends Vue {

    @Ref() readonly map!: TraceMap;

    satelliteLayerOpacity: number = preferences.get('panel.satellite-layer-opacity') || 0;

    private angleDiffThreshold: number = preferences.get('panel.angle-diff-threshold') || 120;
    private autoConfirmNext: boolean = preferences.get('panel.auto-confirm-next') || false;
    private focuse: algorithms.Projection | null = null;
    private selection: GeoJSON.Feature<GeoJSON.LineString> | null = null;
    private stage = Stage.idle;
    private trace: Array<GeoJSON.Position> = [ ];
    private traceSliceIndex?: number = undefined;

    mounted() { }

    @Watch('angleDiffThreshold')
    onAngleDiffThresholdChanged(value: number) {
        preferences.set('panel.angle-diff-threshold', value);
    }

    @Watch('autoConfirmNext')
    onAutoConfirmNextChanged(value: boolean) {
        preferences.set('panel.auto-confirm-next', value);
    }

    @Watch('satelliteLayerOpacity')
    onSatelliteLayerOpacityChanged(value: number) {
        preferences.set('panel.satellite-layer-opacity', value);
    }

    onCommand(value: PanelCommand) {
        switch (value) {
            case PanelCommand.cancel    : { this.cancelCommand()    ; break; }
            case PanelCommand.clear     : { this.clearCommand()     ; break; }
            case PanelCommand.confirm   : { this.confirmCommand()   ; break; }
            case PanelCommand.export    : { this.exportCommand()    ; break; }
            case PanelCommand.load      : { this.loadCommand()      ; break; }
            case PanelCommand.removeLast: { this.removeLastCommand(); break; }
            case PanelCommand.reverse   : { this.reverseCommand()   ; break; }
            case PanelCommand.save      : { this.saveCommand()      ; break; }
            case PanelCommand.selectEnd : { this.selectEndCommand() ; break; }
            case PanelCommand.selectNext: { this.selectNextCommand(); break; }
            case PanelCommand.start     : { this.startCommand()     ; break; }
        }
    }

    onSelect(event: mapboxgl.MapLayerMouseEvent) {
        if (!event.features || event.features.length === 0) return;
        switch (this.stage) {
            case Stage.selectFirstLine: {
                this.selectFirstLine(event.lngLat, event.features[0].geometry);
                return;
            }
            case Stage.selectDirection: {
                if (event.features.some(item => TraceMapConstants.isSelection(item.layer.id))) {
                    this.selectDirection(event.lngLat)
                } else {
                    this.selectFirstLine(event.lngLat, event.features[0].geometry);
                }
                return;
            }
            case Stage.selectNext: {
                const selected = event.features.find(item => TraceMapConstants.isRailway(item.layer.id));
                if (selected) {
                    this.selectNextLine(event.lngLat, selected.geometry);
                }
                return;
            }
            case Stage.selectEnd: {
                const selected = event.features.find(item => TraceMapConstants.isTrace(item.layer.id));
                if (selected) {
                    this.selectEnd(event.lngLat);
                }
                return;
            }
            case Stage.selectReversePosition: {
                const selected = event.features.find(item => TraceMapConstants.isTrace(item.layer.id));
                if (selected) {
                    this.selectReversePoint(event.lngLat);
                }
                return;
            }
        }
    }

    private cancelCommand() {
        this.selection = null;
        this.focuse = null;
        this.stage = Stage.idle;
    }

    private clearCommand() {
        this.focuse = null;
        this.selection = null;
        this.stage = Stage.confirmClear;
    }

    private confirmClear() {
        this.focuse = null;
        this.selection = null;
        this.trace = [ ];
        this.stage = Stage.idle;
    }

    private confirmCommand() {
        switch (this.stage) {
            case Stage.confirmNext              : { this.confirmNext()              ; return; }
            case Stage.confirmEnd               : { this.confirmEnd()               ; return; }
            case Stage.confirmReversePosition   : { this.confirmReversePosition()   ; return; }
            case Stage.confirmClear             : { this.confirmClear()             ; return; }
        }
    }

    private confirmEnd() {
        if (!this.focuse || this.focuse.properties.index === undefined) {
            this.cancelCommand();
            return;
        }
        const insertPoints: GeoJSON.Position[] = [ ];
        if (this.focuse.geometry.coordinates !== this.trace[this.focuse.properties.index]) {
            insertPoints.push(this.focuse.geometry.coordinates);
        }
        this.trace.splice(
            this.focuse.properties.index + 1,
            this.trace.length - this.focuse.properties.index,
            ...insertPoints
        );
        this.focuse = null;
        this.stage = Stage.idle;
    }

    private confirmNext() {
        if (!this.selection) return;
        const segment = toRaw(this.selection.geometry.coordinates);
        if (this.traceSliceIndex) {
            this.trace.splice(this.traceSliceIndex, this.trace.length - this.traceSliceIndex);
            this.traceSliceIndex = undefined;
        }
        if (this.trace[this.trace.length - 1] === segment[0]) segment.shift();
        this.trace.push(...segment);
        this.focuse = null;
        this.selection = null;
        this.search();
    }

    private confirmReversePosition() {
        if (!this.focuse || this.focuse.properties.index === undefined || this.trace.length < 2) return;
        let insertPoints: GeoJSON.Position[];
        if (this.focuse.geometry.coordinates === this.trace[this.focuse.properties.index]) {
            insertPoints = [ this.trace[this.focuse.properties.index - 1] ];
        } else {
            insertPoints = [ this.focuse.geometry.coordinates, this.trace[this.focuse.properties.index] ];
        }
        this.trace.splice(
            this.focuse.properties.index + 1,
            this.trace.length - this.focuse.properties.index,
            ...insertPoints
        );
        this.focuse = null;
        this.stage = Stage.idle;
    }

    private exportCommand() {
        const kml = toKML(turf.featureCollection([ turf.lineString(this.trace.map(item => toRaw(item))) ]));
        const blob = new Blob([ kml ], { type: 'application/vnd' });
        const anchor = eli('a', {
            href: URL.createObjectURL(blob),
            download: 'trace.kml',
            hidden: true
        });
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
    }

    private async loadCommand() {
        this.focuse = null;
        this.selection = null;
        this.stage = Stage.idle;
        const input = eli('input', {
            type: 'file',
            accept: 'json',
            hidden: true
        });
        const file = await new Promise<File | undefined>(resolve => {
            input.addEventListener('change', () => {
                setTimeout(() => input.remove(), 1000);
                if (input.files && input.files.length > 0) {
                    resolve(input.files[0])
                } else {
                    resolve(undefined)
                }
            }, false);
            document.body.append(input);
            input.click();
        });
        if (!file) return;
        const content = await new Promise<string | undefined>(resolve => {
            const fileReader = new FileReader();
            fileReader.onload = () => {
                if (typeof fileReader.result === 'string') {
                    resolve(fileReader.result);
                } else {
                    resolve(undefined);
                }
            };
            fileReader.readAsText(file);
        });
        if (!content) return;
        try {
            const raws = JSON.parse(content) as Array<GeoJSON.Position>;
            // Validate
            for (const item of raws) {
                if (item.length !== 2 || typeof item[0] !== 'number' || typeof item[1] !== 'number') return;
                if (item[0] < -180 || item[0] > 180 || item[1] < -90 || item[1] > 90) return;
            }
            this.trace = raws;
        } catch (error) {
            
        }
    }

    private removeLastCommand() {
        this.stage = Stage.idle;
        this.selection = null;
        this.focuse = null;
        this.trace.pop();
    }

    private reverseCommand() {
        this.selection = null;
        this.focuse = null;
        this.stage = Stage.selectReversePosition;
    }

    private saveCommand() {
        const raws = this.trace.map(item => toRaw(item));
        const blob = new Blob([ JSON.stringify(raws, null, 4) ], { type: 'application/json' });
        const anchor = eli('a', {
            href: URL.createObjectURL(blob),
            download: 'trace.json',
            hidden: true
        });
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
    }

    private async search() {
        while (this.trace.length > 1) {
            this.stage = Stage.searchNext;
            const segment = await this.searchNextLine();
            if (this.stage != Stage.searchNext) break;
            if (segment.length < 2) {
                this.stage = Stage.selectNext;
                break;
            }
            if (this.autoConfirmNext) {
                if (this.trace[this.trace.length - 1] === segment[0]) segment.shift();
                this.trace.push(...segment);
            } else {
                this.selection = turf.lineString(segment);
                this.stage = Stage.confirmNext;
                break;
            }
        }
    }

    private async searchNextLine() : Promise<Array<GeoJSON.Position>> {
        if (this.trace.length < 2) return [ ];
        const point = this.trace[this.trace.length - 1];
        const features = await this.map.search(point);
        if (features.length < 1) return [ ];
        return algorithms.chooseNextLine(point, this.trace, features, this.angleDiffThreshold);
    }

    private selectDirection(position: mapboxgl.LngLat) {
        if (!this.selection || !this.focuse
            || this.focuse.properties.location === undefined
            || this.focuse.properties.index === undefined
        ) {
            return;
        }
        const projection = algorithms.nearestPointOnLine(this.selection, [ position.lng, position.lat ]);
        if (!projection || projection.properties.location === this.focuse.properties.location) {
            return;
        }
        let segment = [ this.focuse.geometry.coordinates ];
        if (projection.properties.location > this.focuse.properties.location) {
            // Forward
            segment.push(...this.selection.geometry.coordinates.slice(this.focuse.properties.index + 1));
        } else {
            // Backward
            segment.push(...this.selection.geometry.coordinates.slice(0, this.focuse.properties.index + 1).reverse());
        }
        this.trace.push(...segment.map(item => toRaw(item)));
        this.focuse = null;
        this.selection = null;
        this.search();
    }

    private selectEnd(position: mapboxgl.LngLat) {
        if (this.trace.length < 2) return;
        const traceFeature = turf.lineString(this.trace);
        const projection = algorithms.nearestPointOnLine(traceFeature, [ position.lng, position.lat ]);
        if (!projection
            || projection.properties.location === 0
            || projection.properties.index === this.trace.length - 1
        ) {
            return;
        }
        this.focuse = projection;
        this.stage = Stage.confirmEnd;
    }

    private selectEndCommand() {
        this.selection = null;
        this.focuse = null;
        this.stage = Stage.selectEnd;
    }

    private selectFirstLine(position: mapboxgl.LngLat, geometry: GeoJSON.Geometry) {
        const nearest = algorithms.nearestLine(geometry, [ position.lng, position.lat ]);
        if (!nearest) return;
        // Begin
        if (nearest.point.properties.location === 0) {
            this.trace = nearest.line.coordinates;
            this.search();
            return;
        }
        // End
        if (nearest.point.properties.index === nearest.line.coordinates.length - 1) {
            this.trace = nearest.line.coordinates.reverse();
            this.search();
            return;
        }
        this.selection = turf.feature(nearest.line);
        this.focuse = nearest.point;
        this.stage = Stage.selectDirection;
    }

    private selectNextCommand() {
        this.selection = null;
        this.focuse = null;
        this.stage = Stage.selectNext;
    }

    private selectNextLine(position: mapboxgl.LngLat, geometry: GeoJSON.Geometry) {
        const result = algorithms.processNextLine(position, geometry, this.trace);
        if (!result) return;
        this.traceSliceIndex = result.traceSliceIndex;
        this.focuse = result.focuse;
        this.selection = result.selection;
        this.stage = Stage.confirmNext;
    }

    private selectReversePoint(position: mapboxgl.LngLat) {
        const nearest = algorithms.nearestPointOnLine(turf.lineString(this.trace), [ position.lng, position.lat ]);
        if (!nearest) return;
        this.focuse = nearest;
        this.stage = Stage.confirmReversePosition;
    }

    private startCommand() {
        if (this.trace.length < 1) {
            this.stage = Stage.selectFirstLine;
        } else {
            this.search();
        }
    }
}
</script>

<style lang="scss">
@use './variables';
@use '@material/theme' with (
    $primary: variables.$primary,
    $secondary: variables.$secondary,
);
@use '~@material/typography';
@import url('https://fonts.googleapis.com/css?family=Roboto:300,400,500&display=swap');

@include theme.core-styles;

html {
    // Fix for iOS standalone mode
    height: calc(100% + env(safe-area-inset-top, 0));
}

body, #app {
    margin: 0;
    height: 100%;
    min-height: 100%;
    max-height: 100%;
}

#app {
    @include typography.base();
    display: flex;
    flex-flow: column nowrap;

    > main {
        flex: 1;

        display: flex;
        flex-flow: column nowrap;

        @media screen and (min-width: 600px) {
            flex-flow: row nowrap;
            min-height: 0%;
        }

        .map-container {
            flex: 2;
        }

        .controller {
            flex: 1;
        }
    }
}
</style>