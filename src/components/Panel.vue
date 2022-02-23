<template>
<material-card class="panel">
    <div class="row">
        <span>{{ $t(`stage.${stageText}`) }}</span>
        <div class="spacer"/>
        <material-button @click="onClickMoreLess">{{ moreLessButtonText }}</material-button>
    </div>
    <div class="divider"/>
    <div class="commands">
        <material-button outlined v-if="idle" @click="onClickStart">{{ $t('start') }}</material-button>
        <material-button outlined v-if="confirming" @click="onClickConfirm">{{ $t('confirm') }}</material-button>
        <material-button outlined v-if="idle && traceNotEmpty" @click="onClickSelectNext">{{ $t('selectNext') }}</material-button>
        <material-button outlined v-if="idle && traceNotEmpty" @click="onClickReverse">{{ $t('reverse') }}</material-button>
        <material-button outlined v-if="idle && traceNotEmpty" @click="onClickSelectEnd">{{ $t('selectEnd') }}</material-button>
        <material-button outlined v-if="!idle" @click="onClickCancel">{{ $t('cancel') }}</material-button>
    </div>
    <div class="commands" v-if="idle">
        <material-button outlined v-if="traceNotEmpty" @click="onClickSave">{{ $t('save') }}</material-button>
        <material-button outlined @click="onClickLoad">{{ $t('load') }}</material-button>
        <material-button outlined v-if="traceNotEmpty" @click="onClickExport">{{ $t('export') }}</material-button>
    </div>
    <div class="commands" v-if="idle && traceNotEmpty">
        <material-button outlined @click="onClickRemoveLast">{{ $t('removeLastPoint') }}</material-button>
        <material-button outlined @click="onClickClear">{{ $t('clearTrace') }}</material-button>
    </div>
    <div class="divider"/>
    <div class="row">
        <span>{{ $t('autoConfirmNext') }}</span>
        <div class="spacer"/>
        <material-switch v-model="autoConfirmNextValue"/>
    </div>
    <div v-if="showMore">
        <div>{{ $t('angleDiffThreshold') }}</div>
        <material-slider
            v-model="angleDiffThresholdValue"
            :min="1"
            :max="180"
            :label="$t('angleDiffThreshold')"
            name="angle-diff-threshold"
        />
    </div>
    <div v-if="showMore">
        <div>{{ $t('satelliteLayerOpacity') }}</div>
        <material-slider
            v-model="satelliteLayerOpacityValue"
            :label="$t('satelliteLayerOpacityValue')"
            name="satellite-layer-opacity"
        />
    </div>
    <div class="footer" v-if="showMore">
        <div>RailTracing</div>
        <div>Lucka | <a href="https://github.com" title="GitHub" target="_blank" rel="noopener">Code</a></div>
    </div>
</material-card>
</template>

<script lang="ts">
import { Vue, Options, Prop, Model } from 'vue-property-decorator';

import MaterialButton from '@/components/material/Button.vue';
import MaterialCard from '@/components/material/Card.vue';
import MaterialSlider from '@/components/material/Slider.vue';
import MaterialSwitch from '@/components/material/Switch.vue';

import { Stage } from '@/service/stage';

import locales from './Panel.locales.json';

export enum PanelCommand {
    cancel,
    clear,
    confirm,
    export,
    load,
    removeLast,
    reverse,
    save,
    selectEnd,
    selectNext,
    start,
}

@Options({
    components: {
        MaterialButton, MaterialCard, MaterialSlider, MaterialSwitch
    },
    emits: [ 'command' ],
    i18n: {
        messages: locales
    }
})
export default class Panel extends Vue {

    @Model('angleDiffThreshold', Number) readonly angleDiffThresholdValue!: number;
    @Model('autoConfirmNext', Boolean) readonly autoConfirmNextValue!: boolean;
    @Model('satelliteLayerOpacity', Number) readonly satelliteLayerOpacityValue!: number;
    @Prop(Number) readonly stage!: Stage;
    @Prop(Array) readonly trace! : Array<GeoJSON.Position>;

    showMore: boolean = false;

    get stageText(): string {
        switch (this.stage) {
            case Stage.idle:    return 'idle';
            
            case Stage.selectFirstLine: return 'selectFirstLine';
            case Stage.selectDirection: return 'selectDirection';
            
            case Stage.searchNext:  return 'searchNext';
            case Stage.selectNext:  return 'selectNext';
            case Stage.confirmNext: return 'confirmNext';

            case Stage.selectReversePosition:   return 'selectReversePosition';
            case Stage.confirmReversePosition:  return 'confirmReversePosition';

            case Stage.selectEnd:   return 'selectEnd';
            case Stage.confirmEnd:  return 'confirmEnd';

            case Stage.confirmClear:    return 'confirmClear';

            default:    return 'unknown';
        }
    }

    get moreLessButtonText() : string {
        return this.$t(this.showMore ? 'less' : 'more');
    }

    get idle() : boolean {
        return this.stage === Stage.idle;
    }

    get traceNotEmpty() :boolean {
        return this.trace.length > 0;
    }

    get confirming() : boolean {
        return this.stage === Stage.confirmNext
            || this.stage === Stage.confirmEnd
            || this.stage === Stage.confirmReversePosition
            || this.stage === Stage.confirmClear;
    }

    onClickCancel       = () => this.emitCommand(PanelCommand.cancel    );
    onClickClear        = () => this.emitCommand(PanelCommand.clear     );
    onClickConfirm      = () => this.emitCommand(PanelCommand.confirm   );
    onClickExport       = () => this.emitCommand(PanelCommand.export    );
    onClickLoad         = () => this.emitCommand(PanelCommand.load      );
    onClickRemoveLast   = () => this.emitCommand(PanelCommand.removeLast);
    onClickReverse      = () => this.emitCommand(PanelCommand.reverse   );
    onClickSave         = () => this.emitCommand(PanelCommand.save      );
    onClickSelectEnd    = () => this.emitCommand(PanelCommand.selectEnd );
    onClickSelectNext   = () => this.emitCommand(PanelCommand.selectNext);
    onClickStart        = () => this.emitCommand(PanelCommand.start     );

    onClickMoreLess() {
        this.showMore = !this.showMore;
    }

    private emitCommand(command: PanelCommand) {
        this.$emit('command', command);
    }
}
</script>

<style lang="scss">
@use '~@material/theme';
@use '~@material/typography';

.panel {
    z-index: 100;
    position: fixed;
    left: calc(10px + env(safe-area-inset-left, 0));
    right: calc(10px + env(safe-area-inset-right, 0));
    bottom: calc(50px + env(safe-area-inset-bottom, 0));
    max-height: 30%;

    @media screen and (min-width: 600px) {
        top: calc(10px + env(safe-area-inset-top, 0));
        right: unset;
        bottom: unset;
        width: 40%;
        max-width: 25rem;
        max-height: calc(100% - 50px - env(safe-area-inset-top, 0) - env(safe-area-inset-bottom, 0));
    }

    .mdc-card__content {
        display: flex;
        flex-flow: column nowrap;
        scroll-behavior: smooth;

        padding: 1rem;

        overflow-y: auto;

        > * {
            flex: 0 0 auto;
        }

        > :not(:first-child) {
            margin-top: 0.2rem;
        }

        > .divider {
            border-block-end: 1px solid;
            @include theme.property(border-inline-end-color, text-secondary-on-light);
            margin-block-start: 0.4rem;
            margin-block-end: 0.4rem;
        }

        > .commands {
            display: flex;
            flex-flow: row wrap;

            > * {
                margin-top: 0.15rem;
                margin-bottom: 0.15rem;
            }
        }

        > .row {
            display: flex;
            flex-flow: row nowrap;
            align-items: center;

            overflow: hidden;

            > span {
                @include typography.overflow-ellipsis;
            }

            > .spacer {
                flex: 1;
                min-width: 0.5rem;
            }
        }

        > .footer {
            @include typography.typography(overline);

            display: flex;
            flex-flow: column nowrap;
            align-items: center;
            text-align: center;

            a {
                @include theme.property(color, text-primary-on-light);
                text-decoration: none;
            }
        }
    }
}
</style>