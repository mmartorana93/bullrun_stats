const webpack = require('webpack');

module.exports = function override(config) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "zlib": require.resolve("browserify-zlib"),
    "url": require.resolve("url/"),
    "buffer": require.resolve("buffer/"),
    "process": require.resolve("process/browser"),
    "assert": require.resolve("assert/"),
    "util": require.resolve("util/")
  });
  config.resolve.fallback = fallback;
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ]);
  config.module = {
    ...config.module,
    rules: [
      ...config.module.rules,
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false
        }
      },
      {
        test: /node_modules[\\\/]@?ajv/,
        resolve: {
          fullySpecified: false
        }
      }
    ]
  };
  config.resolve.alias = {
    ...config.resolve.alias,
    'ajv$': 'ajv/dist/ajv.bundle.js'
  };
  return config;
};
