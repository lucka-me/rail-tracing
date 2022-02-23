<template>
<div class="mdc-card">
    <div class="mdc-card__content">
        <slot/>
    </div>
</div>
</template>

<script lang="ts">
import { Vue } from 'vue-property-decorator';

export default class MaterialCard extends Vue { }
</script>

<style lang="scss">
@use '~@material/card';

@include card.core-styles;
</style>