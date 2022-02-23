<template>
<div class="map-container" ref="container"/>
</template>

<script lang="ts">
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { Vue, Options, Ref, Prop, Watch } from 'vue-property-decorator';

import 'mapbox-gl/dist/mapbox-gl.css';

import { preferences } from '@/service/preferences';
import { toRaw } from '@vue/reactivity';

@Options({
    emits: [ 'select' ]
})
export default class TraceMap extends Vue {

    private static readonly satelliteLayerId = 'satellite';
    private static readonly selectionSourceId = 'selection';
    private static readonly traceSourceId = 'trace';

    private static readonly emptyData : GeoJSON.FeatureCollection<GeoJSON.Geometry> = {
        type: 'FeatureCollection', features: [ ]
    };

    @Prop(Array) readonly trace!: Array<GeoJSON.Position>;
    @Prop(Number) readonly satelliteLayerOpacity!: number;
    @Prop(Object) readonly focuse: GeoJSON.Feature<GeoJSON.Point> | null = null;
    @Prop(Object) readonly selection: GeoJSON.Feature<GeoJSON.LineString> | null = null;
    @Ref() readonly container!: HTMLDivElement;

    private ctrl?: mapboxgl.Map = undefined;
    private focuseMarker?: mapboxgl.Marker = undefined;

    mounted() {
        if (!this.ctrl) {
            this.initializeMap();
        }
    }

    @Watch('focuse')
    onFocuseChanged(value: GeoJSON.Feature<GeoJSON.Point> | null, _: unknown) {
        if (!this.ctrl) return;
        if (this.focuseMarker) {
            this.focuseMarker.remove();
            this.focuseMarker = undefined;
        }
        if (!value) return;
        this.focuseMarker = new mapboxgl.Marker()
            .setLngLat({ lng: value.geometry.coordinates[0], lat: value.geometry.coordinates[1] })
            .addTo(this.ctrl);
    }

    @Watch('satelliteLayerOpacity')
    onSatelliteLayerOpacityChanged(value: number, _: unknown) {
        if (!this.ctrl) return;
        if (value === 0) {
            this.ctrl.setLayoutProperty(TraceMap.satelliteLayerId, 'visibility', 'none');
        } else {
            this.ctrl.setLayoutProperty(TraceMap.satelliteLayerId, 'visibility', 'visible');
            this.ctrl.setPaintProperty(TraceMap.satelliteLayerId, 'raster-opacity', value / 100);
        }
    }

    @Watch('selection')
    onSelectionChanged(value: GeoJSON.Feature<GeoJSON.LineString> | null, _: unknown) {
        if (!this.ctrl) return;
        const raw = toRaw(value);
        const selectionSource = this.ctrl.getSource(TraceMap.selectionSourceId) as mapboxgl.GeoJSONSource;
        selectionSource.setData(raw || TraceMap.emptyData);
    }

    @Watch('trace', { deep: true })
    onTraceChanged(value: GeoJSON.Position[], _: unknown) {
        if (!this.ctrl) return;
        const raw = toRaw(value);
        const traceSource = this.ctrl.getSource(TraceMap.traceSourceId) as mapboxgl.GeoJSONSource;
        traceSource.setData(raw.length > 1 ? turf.lineString(raw) : TraceMap.emptyData);
    }

    async search(position: GeoJSON.Position) : Promise<Array<mapboxgl.MapboxGeoJSONFeature>> {
        if (!this.ctrl) return [ ];
        const center = { lng: position[0], lat: position[1] };
        this.ctrl.flyTo({ center: center, zoom: Math.max(this.ctrl.getZoom(), 16) });
        await this.ctrl.once('idle');
        const point = this.ctrl.project(center);
        return this.ctrl.queryRenderedFeatures(
            pointBuffer(point),
            { layers: [ TraceMapConstants.railwayMajorLayerId, TraceMapConstants.railwayServiceLayerId ] }
        );
    }

    private async initializeMap() {
        this.ctrl = new mapboxgl.Map({
            accessToken: 'pk.eyJ1IjoibHVja2EtbWUiLCJhIjoiY2poa2xyN3J4MGJ0bTM3bjV5bjdvNDh3ZSJ9.QztckHrHyEuKp5_pVXmpIw',
            container: this.container,
            style: 'mapbox://styles/lucka-me/ckygr9e7s29n314pfwq032erb',

            pitchWithRotate: false,
            touchPitch: false,

            bearing: preferences.get('map.camera.bearing') || 0,
            center: {
                lng: preferences.get('map.camera.lng') || 114.175409,
                lat: preferences.get('map.camera.lat') || 22.299153
            },
            pitch: preferences.get('map.camera.pitch') || 0,
            zoom: preferences.get('map.camera.zoom') || 13,
        });
        this.ctrl.addControl(new mapboxgl.NavigationControl());
        await this.ctrl.once('idle');
        this.ctrl.resize();
        const satelliteLayerOpacity = preferences.get('panel.satellite-layer-opacity') || 0;
        if (satelliteLayerOpacity > 0) {
            this.ctrl.setLayoutProperty(TraceMap.satelliteLayerId, 'visibility', 'visible');
            if (satelliteLayerOpacity !== 20) {
                this.ctrl.setPaintProperty(TraceMap.satelliteLayerId, 'raster-opacity', satelliteLayerOpacity / 100);
            }
        }
        // Add empty source
        this.ctrl.addSource(TraceMap.traceSourceId, { type: 'geojson', data: TraceMap.emptyData });
        this.ctrl.addSource(TraceMap.selectionSourceId, { type: 'geojson', data: TraceMap.emptyData });
        this.ctrl.addLayer({
            id: TraceMapConstants.traceLayerId,
            type: 'line',
            source: TraceMap.traceSourceId,
            layout: {
                'line-cap': 'round',
                'line-join': 'round'
            },
            paint: {
                'line-color': 'hsl(120, 100%, 50%)',
                'line-width': 3
            }
        });
        this.ctrl.addLayer({
            id: TraceMapConstants.selectionLayerId,
            type: 'line',
            source: TraceMap.selectionSourceId,
            layout: {
                'line-cap': 'round',
                'line-join': 'round'
            },
            paint: {
                'line-color': 'hsl(50, 100%, 60%)',
                'line-width': 3
            }
        });
        this.ctrl.on('click', this.onClicked);
        this.ctrl.on('idle', this.onIdle);
    }

    private onClicked(event: mapboxgl.MapMouseEvent & mapboxgl.EventData) {
        if (!this.ctrl) return;
        const features = this.ctrl.queryRenderedFeatures(pointBuffer(event.point), {
            layers: [
                TraceMapConstants.railwayMajorLayerId,
                TraceMapConstants.railwayServiceLayerId,
                TraceMapConstants.selectionLayerId,
                TraceMapConstants.traceLayerId,
            ]
        });
        if (features.length === 0) return;
        const layerMouseEvent: mapboxgl.MapLayerMouseEvent = event;
        layerMouseEvent.features = features;
        this.$emit('select', layerMouseEvent);
    }

    private onIdle() {
        if (!this.ctrl) return;
        const center = this.ctrl.getCenter();
        preferences.set('map.camera.lng', center.lng);
        preferences.set('map.camera.lat', center.lat);
        preferences.set('map.camera.zoom', this.ctrl.getZoom());
        preferences.set('map.camera.bearing', this.ctrl.getBearing());
        preferences.set('map.camera.pitch', this.ctrl.getPitch());
    }
}

export namespace TraceMapConstants {
    export const railwayMajorLayerId = 'railway-major';
    export const railwayServiceLayerId = 'railway-service';
    export const selectionLayerId = 'selection-line';
    export const traceLayerId = 'trace-line';

    export function isRailway(id: string) : boolean {
        return id === railwayMajorLayerId || id === railwayServiceLayerId;
    }

    export function isSelection(id: string) : boolean {
        return id === selectionLayerId;
    }

    export function isTrace(id: string) : boolean {
        return id === traceLayerId;
    }
}

function pointBuffer(point: mapboxgl.Point) : [ mapboxgl.Point, mapboxgl.Point ] {
    return [ new mapboxgl.Point(point.x - 3, point.y + 3), new mapboxgl.Point(point.x + 3, point.y - 3) ];
}
</script>

<style lang="scss">
.map-container {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;

    // Adjust for safe area
    .mapboxgl-control-container {
        > .mapboxgl-ctrl-top-left, > .mapboxgl-ctrl-bottom-left {
            margin-left: env(safe-area-inset-left, 0);
        }

        > .mapboxgl-ctrl-top-left, > .mapboxgl-ctrl-top-right {
            margin-top: env(safe-area-inset-top, 0);
        }

        > .mapboxgl-ctrl-top-right, > .mapboxgl-ctrl-bottom-right {
            margin-right: env(safe-area-inset-right, 0);
        }

        > .mapboxgl-ctrl-bottom-left, > .mapboxgl-ctrl-bottom-right {
            margin-bottom: env(safe-area-inset-bottom, 0);
        }
    }
}
</style>