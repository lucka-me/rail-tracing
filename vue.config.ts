import { ProjectOptions } from '@vue/cli-service';

const publicPath = '/';

const options: ProjectOptions = {
    publicPath: publicPath,
    pwa: {
        name: 'RailTracing',
        themeColor: '#d65c5c',
        msTileColor: '#5299e0',
        appleMobileWebAppCapable: 'yes',
        appleMobileWebAppStatusBarStyle: 'black-translucent',
        iconPaths: {
            faviconSVG: null,
            favicon16: null,
            favicon32: 'assets/icon-transparent.png',
            appleTouchIcon: 'assets/icon-maskable.png',
            maskIcon: null,
            msTileImage: 'assets/icon-transparent.png',
        },
        manifestOptions: {
            description: 'Web App',
            start_url: publicPath,
            scope: publicPath,
            display: 'standalone',
            background_color: '#d65c5c',
            icons: [
                {
                    src: `${publicPath}assets/icon-maskable.png`,
                    sizes: '512x512',
                    purpose: 'maskable',
                }
            ]
        }
    },
};

module.exports = options;