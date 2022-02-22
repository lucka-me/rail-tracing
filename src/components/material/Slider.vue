<template>
<div class="mdc-slider mdc-slider--discrete">
    <input class="mdc-slider__input"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :name="name"
        :aria-label="label"
    >
    <div class="mdc-slider__track">
        <div class="mdc-slider__track--inactive"></div>
        <div class="mdc-slider__track--active">
            <div class="mdc-slider__track--active_fill"></div>
        </div>
    </div>
    <div class="mdc-slider__thumb">
        <div class="mdc-slider__value-indicator-container" aria-hidden="true">
            <div class="mdc-slider__value-indicator">
                <span class="mdc-slider__value-indicator-text">50</span>
            </div>
        </div>
        <div class="mdc-slider__thumb-knob"></div>
    </div>
</div>
</template>

<script lang="ts">
import { MDCSlider } from '@material/slider';
import { Vue, Model, Prop, Watch } from 'vue-property-decorator';

export default class MaterialSlider extends Vue {

    @Model('modelValue', { type: Number, default: 50 }) readonly value!: number;
    @Prop({ type: Number, default: 0 }) readonly min?: number;
    @Prop({ type: Number, default: 100 }) readonly max?: number;
    @Prop({ type: Number, default: 1 }) readonly step?: number;
    @Prop(String) readonly name?: string;
    @Prop(String) readonly label?: string;

    private ctrl?: MDCSlider;

    @Watch('value')
    onValueChanged(newVal: number, _: string) {
        if (!this.ctrl) return;
        this.ctrl.setValue(newVal);
    }

    mounted() {
        // Fix missing value
        (this.$el as HTMLDivElement).querySelector('input')!.setAttribute('value', `${this.value}`);
        this.ctrl = MDCSlider.attachTo(this.$el);
        this.ctrl.setValue(this.value);
        this.ctrl.listen('MDCSlider:change', this.onChange);
    }

    unmounted() {
        this.ctrl?.destroy();
    }

    private onChange() {
        if (!this.ctrl) return;
        this.$emit('update:modelValue', this.ctrl.getValue());
    }
}
</script>

<style lang="scss">
@use '@material/slider/styles';
</style>