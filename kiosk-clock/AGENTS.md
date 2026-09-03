# Working in this repo

Expo SDK 57 / React Native 0.86. Check the versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before using an Expo API — several
APIs moved in recent SDKs, and `StyleSheet.absoluteFillObject` no longer
exists in RN 0.86 (use `StyleSheet.absoluteFill`).

`npx expo install` needs network access to Expo's version API. Where that is
blocked, read the SDK-compatible version out of
`node_modules/expo/bundledNativeModules.json` and install it with npm directly.

`react` and `react-dom` must stay pinned to the same exact version — react-dom
peer-depends on the precise react build, so a caret range on either one breaks
installation.

Before pushing: `npm run typecheck` and `npm run bundle` (the latter runs the
real Metro bundler and catches resolution errors that typechecking misses).
