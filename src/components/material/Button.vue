<template>
<button class="mdc-button mdc-button--outlined">
    <span class="mdc-button__ripple"></span>
    <span class="mdc-button__label"><slot/></span>
</button>
</template>

<script lang="ts">
import { MDCRipple } from '@material/ripple';
import { Vue } from 'vue-property-decorator';

export default class MaterialButton extends Vue {

    private ctrl?: MDCRipple;

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