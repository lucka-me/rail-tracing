<template>
<div class="controller">
    <div class="stage">
        <span>{{ $t(`stage.${stageText}`) }}</span>
    </div>
    <div class="divider"/>
    <div class="commands">
        <material-button v-if="idle" @click="onClickStart">{{ $t('start') }}</material-button>
        <material-button v-if="confirming" @click="onClickConfirm">{{ $t('confirm') }}</material-button>
        <material-button v-if="idle && traceNotEmpty" @click="onClickSelectNext">{{ $t('selectNext') }}</material-button>
        <material-button v-if="idle && traceNotEmpty" @click="onClickReverse">{{ $t('reverse') }}</material-button>
        <material-button v-if="idle && traceNotEmpty" @click="onClickSelectEnd">{{ $t('selectEnd') }}</material-button>
        <material-button v-if="!idle" @click="onClickCancel">{{ $t('cancel') }}</material-button>
    </div>
    <div class="commands" v-if="idle">
        <material-button v-if="traceNotEmpty" @click="onClickSave">{{ $t('save') }}</material-button>
        <material-button @click="onClickLoad">{{ $t('load') }}</material-button>
        <material-button v-if="traceNotEmpty" @click="onClickExport">{{ $t('export') }}</material-button>
    </div>
    <div class="commands" v-if="idle && traceNotEmpty">
        <material-button @click="onClickRemoveLast">{{ $t('removeLastPoint') }}</material-button>
        <material-button @click="onClickClear">{{ $t('clearTrace') }}</material-button>
    </div>
    <div class="divider"/>
    <div class="row">
        <span>{{ $t('autoConfirmNext') }}</span>
        <div class="spacer"/>
        <material-switch v-model="autoConfirmNextValue"/>
    </div>
    <div>
        <div>{{ $t('angleDiffThreshold') }}</div>
        <material-slider
            v-model="angleDiffThresholdValue"
            :min="1"
            :max="180"
            :label="$t('angleDiffThreshold')"
            name="angle-diff-threshold"
        />
    </div>
    <div>
        <div>{{ $t('satelliteLayerOpacity') }}</div>
        <material-slider
            v-model="satelliteLayerOpacityValue"
            :label="$t('satelliteLayerOpacityValue')"
            name="satellite-layer-opacity"
        />
    </div>
    <div class="footer">
        <div>RailTracing</div>
        <div>Lucka | <a href="https://github.com" title="GitHub" target="_blank" rel="noopener">Code</a></div>
    </div>
</div>
</template>

<script lang="ts">
import { Vue, Options, Prop, Model } from 'vue-property-decorator';

import MaterialButton from '@/components/material/Button.vue';
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
        MaterialButton, MaterialSwitch, MaterialSlider
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

    private emitCommand(command: PanelCommand) {
        this.$emit('command', command);
    }
}
</script>

<style lang="scss">
@use '~@material/theme';
@use '~@material/typography';

.controller {
    display: flex;
    flex-flow: column nowrap;
    scroll-behavior: smooth;

    overflow-y: auto;

    > * {
        flex: 0 0 auto;
        margin-left: max(env(safe-area-inset-left), 1rem);
        margin-right: max(env(safe-area-inset-right), 1rem);
        @media screen and (min-width: 600px) {
            margin-left: 1rem;
        }
    }

    > :first-child {
        margin-top: 1rem;
        @media screen and (min-width: 600px) {
            margin-top: max(env(safe-area-inset-top), 1rem);
        }
    }

    > :last-child {
        margin-bottom: max(env(safe-area-inset-bottom), 1rem);
    }

    > :not(:first-child) {
        margin-top: 0.2rem;
    }

    > .stage {
        display: flex;
        flex-flow: row-reverse nowrap;
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
        align-items: baseline;

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
</style>