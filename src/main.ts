/// <reference types="geojson" />

import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';

import App from './App.vue';

const i18n = createI18n({
    locale: navigator.language,
    fallbackLocale: 'en',
});

createApp(App)
    .use(i18n)
    .mount('#app');