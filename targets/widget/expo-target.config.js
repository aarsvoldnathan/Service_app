/** iPhone home-screen widget (WidgetKit), built by @bacons/apple-targets during prebuild. */
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'ServiceCeoWidget',
  bundleIdentifier: '.widget',
  deploymentTarget: '16.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
};
