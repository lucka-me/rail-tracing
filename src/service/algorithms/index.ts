import type mapboxgl from 'mapbox-gl';
import type { NearestPointOnLine } from '@turf/nearest-point-on-line';

import * as turf from '@turf/turf';

export namespace algorithms {
    export type Projection = NearestPointOnLine & {
        properties: Required<NearestPointOnLine["properties"]>
    };

    export function validateProjection(projection: NearestPointOnLine) : Projection | undefined {
        if (projection.properties.dist !== undefined
            && projection.properties.index !== undefined
            && projection.properties.location !== undefined
        ) {
            return projection as Projection;
        } else {
            return undefined;
        }
    }
}

export namespace algorithms {
    export function angleDiff(a: number, b: number) : number {
        let d = b - a;
        if (d > 180) return d - 360;
        if (d < -180) return d + 360;
        return d;
    }

    export function angleDiffAbs(a: number, b: number) : number {
        return Math.abs(angleDiff(a, b));
    }
}

export namespace algorithms {
    export function nearestPointOnLine<G extends turf.LineString | turf.MultiLineString>(
        lines: turf.Feature<G> | G,
        pt: turf.Coord,
        options?: { units?: turf.Units; }
    ): Projection | undefined {
        return validateProjection(turf.nearestPointOnLine(lines, pt, options));
    }
}

export namespace algorithms {
    export function nearestLine(
        geometry: GeoJSON.Geometry, point: GeoJSON.Feature<GeoJSON.Point> | GeoJSON.Point | GeoJSON.Position
    ) : nearestLine.Result | undefined {
        let line: GeoJSON.LineString | undefined = undefined;
        let projection: Projection | undefined = undefined;
        switch (geometry.type) {
            case 'LineString': {
                const typedGeometry = geometry as GeoJSON.LineString;
                if (typedGeometry.coordinates.length < 2) return undefined;
                line = typedGeometry;
                projection = nearestPointOnLine(typedGeometry, point);
                break;
            }
            case 'MultiLineString': {
                const typedGeometry = geometry as GeoJSON.MultiLineString;
                if (typedGeometry.coordinates.length === 0) return undefined;
                for (const coordinates of typedGeometry.coordinates) {
                    if (coordinates.length < 2) continue;
                    const currentLine = turf.lineString(coordinates).geometry;
                    const currentProjection = nearestPointOnLine(currentLine, point);
                    if (!currentProjection) continue;
                    if (!projection || projection.properties.dist > currentProjection.properties.dist
                    ) {
                        line = currentLine;
                        projection = currentProjection;
                    }
                }
                break;
            }
            default: return undefined;
        }
        if (!line || !projection) return undefined;
        return { line: line, point: projection };
    }

    export namespace nearestLine {
        export interface Result {
            line: GeoJSON.LineString;
            point: Projection;
        };
    }
}

export namespace algorithms {
    export function chooseNextLine(
        point: GeoJSON.Position,
        trace: Array<GeoJSON.Position>,
        features: Array<mapboxgl.MapboxGeoJSONFeature>,
        angleDiffThreshold: number
    ) : Array<GeoJSON.Position> {
        const lastBearing = turf.bearing(trace[trace.length - 2], point);
        let bestBearingDiff = 361;
        let bestLine: algorithms.nearestLine.Result | undefined = undefined;
        let bestForward = true;
        for (const feature of features) {
            const nearest = algorithms.nearestLine(feature.geometry, point);
            if (!nearest) continue;
            const nearestIndex = nearest.point.properties.index;
            if (nearestIndex === undefined) continue;
            let forward = true;
            let bearingDiff = 361;
            let pointsCount = nearest.line.coordinates.length;
            if (nearest.point.properties.location === 0) {
                // Begin
                forward = true;
                bearingDiff = angleDiffAbs(
                    lastBearing, turf.bearing(nearest.line.coordinates[0], nearest.line.coordinates[1])
                );
            } else if (nearestIndex === pointsCount - 1) {
                // End
                forward = false;
                bearingDiff = angleDiffAbs(
                    lastBearing,
                    turf.bearing(nearest.line.coordinates[pointsCount - 1], nearest.line.coordinates[pointsCount - 2])
                );
            } else {
                // Middle
                let previousPoint = nearest.line.coordinates[nearestIndex];
                if (nearest.point.geometry.coordinates === nearest.line.coordinates[nearestIndex]) {
                    previousPoint = nearest.line.coordinates[nearestIndex - 1]
                }
                const bearingToPrevious = turf.bearing(point, previousPoint);
                const bearingToNext = turf.bearing(point, nearest.line.coordinates[nearestIndex + 1]);
                const diffPrevious = angleDiffAbs(lastBearing, bearingToPrevious);
                const diffNext = angleDiffAbs(lastBearing, bearingToNext);
                if (diffPrevious < diffNext) {
                    forward = false;
                    bearingDiff = diffPrevious;
                } else {
                    forward = true;
                    bearingDiff = diffNext;
                }
            }
            if (bearingDiff > angleDiffThreshold) continue;
            if (bearingDiff < bestBearingDiff) {
                bestBearingDiff = bearingDiff;
                bestLine = nearest;
                bestForward = forward;
            }
        }
        if (!bestLine || bestLine.point.properties.index === undefined) return [];
        const segment = bestForward
            ? bestLine.line.coordinates.slice(bestLine.point.properties.index + 1)
            : bestLine.line.coordinates.slice(0, bestLine.point.properties.index + 1).reverse();
        if (segment[0] !== point) segment.unshift(point);
        return segment;
    }
}

export namespace algorithms {
    export function processNextLine(
        position: mapboxgl.LngLat, geometry: GeoJSON.Geometry, trace: Array<GeoJSON.Position>
    ) : processNextLine.Result | undefined {
        if (trace.length < 2) return undefined;
        const selectedLine = algorithms.nearestLine(geometry, [ position.lng, position.lat ])?.line;
        if (!selectedLine) return undefined;
        const intersections = turf.lineIntersect(turf.lineString(trace), selectedLine);
        let pointOnTrace = trace[trace.length - 1];
        let lastBearing = turf.bearing(trace[trace.length - 2], pointOnTrace);
        let traceSliceIndex: number | undefined = undefined;
        if (intersections.features.length > 0) {
            const intersection = intersections.features[intersections.features.length - 1];
            // Reverse the trace then find nearest point, to get the latest slice index
            const reversedTrace = trace.map(item => item).reverse();
            const nearestOnReversedTrace = algorithms.nearestPointOnLine(turf.lineString(reversedTrace), intersection);
            if (nearestOnReversedTrace && nearestOnReversedTrace.geometry.coordinates !== reversedTrace[0]) {
                // Should slice the trace
                // Find the corresponding index on the trace
                let nearestIndex = reversedTrace.length - nearestOnReversedTrace.properties.index - 2;
                pointOnTrace = nearestOnReversedTrace.geometry.coordinates;
                if (pointOnTrace === reversedTrace[nearestOnReversedTrace.properties.index]) {
                    nearestIndex += 1;
                }
                let previousPoint = trace[nearestIndex];
                traceSliceIndex = nearestIndex + 1;
                if (pointOnTrace === trace[nearestIndex]) {
                    previousPoint = trace[nearestIndex - 1];
                }
                lastBearing = turf.bearing(previousPoint, pointOnTrace);
            }
        }
        const nearest = algorithms.nearestPointOnLine(selectedLine, pointOnTrace);
        if (!nearest) return undefined;
        let selection: GeoJSON.Feature<GeoJSON.LineString>;
        if (nearest.properties.location === 0) {
            // Begin
            selection = turf.feature(selectedLine);
        } else if (nearest.properties.index === selectedLine.coordinates.length - 1) {
            // End
            selection = turf.lineString(selectedLine.coordinates.reverse());
        } else {
            // Middle
            const nearestIndex = nearest.properties.index;
            let previousPoint = selectedLine.coordinates[nearestIndex];
            if (nearest.geometry.coordinates === selectedLine.coordinates[nearestIndex]) {
                previousPoint = selectedLine.coordinates[nearestIndex - 1]
            }
            const angleDiffPrevious = Math.abs(angleDiff(lastBearing, turf.bearing(nearest, previousPoint)));
            const angleDiffNext = Math.abs(
                angleDiff(lastBearing, turf.bearing(nearest, selectedLine.coordinates[nearestIndex + 1]))
            );
            const segment = [ nearest.geometry.coordinates ];
            if (angleDiffPrevious < angleDiffNext) {
                // Backward
                segment.push(...selectedLine.coordinates.slice(0, nearest.properties.index + 1).reverse());
            } else {
                // Forward
                segment.push(...selectedLine.coordinates.slice(nearest.properties.index + 1));
            }
            selection = turf.lineString(segment);
        }
        return { selection: selection, focuse: nearest, traceSliceIndex: traceSliceIndex };
    }

    export namespace processNextLine {
        export interface Result {
            selection: GeoJSON.Feature<GeoJSON.LineString>;
            focuse: Projection;
            traceSliceIndex: number | undefined;
        };
    }
}