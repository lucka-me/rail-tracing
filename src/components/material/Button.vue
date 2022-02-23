<template>
<button :class="buttonClassName">
    <span class="mdc-button__ripple"></span>
    <span class="mdc-button__focus-ring"></span>
    <span class="mdc-button__label"><slot/></span>
</button>
</template>

<script lang="ts">
import { MDCRipple } from '@material/ripple';
import { Prop, Vue } from 'vue-property-decorator';

export default class MaterialButton extends Vue {

    @Prop(Boolean) readonly outlined?: boolean;

    private ctrl?: MDCRipple;

    get buttonClassName() : string {
        console.log(this.outlined);
        return `mdc-button ${this.outlined ? 'mdc-button--outlined' : ''}`
    }

    mounted() {
        this.ctrl = MDCRipple.attachTo(this.$el);
        this.ctrl.unbounded = true;
    }

    updated() {
        this.ctrl?.destroy();
        this.ctrl = MDCRipple.attachTo(this.$el);
        this.ctrl.unbounded = true;
    }

    unmounted() {
        this.ctrl?.destroy();
    }
}
</script>

<style lang="scss">
@use '~@material/button/styles';
</style>