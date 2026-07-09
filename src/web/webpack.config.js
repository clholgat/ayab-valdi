const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require('webpack');

const ayabWebPath = path.resolve(__dirname, '.ayab_web_cache');
const ayabWebSrcPath = path.join(ayabWebPath, 'src');
if (!fs.existsSync(path.join(ayabWebPath, 'src', 'RegisterNativeModules.js'))) {
  throw new Error(
    `ayab_web is not built. Run: cd src/web && npm run ensure-ayab-web`
  );
}

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  mode: 'development',
  devtool: 'source-map',
  ignoreWarnings: [
    { message: /Cannot statically analyse 'require/ },
    { message: /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/ },
  ],
  plugins: [
    new HtmlWebpackPlugin({ template: "src/index.html" }),
    new webpack.IgnorePlugin({
      resourceRegExp: /foundation[\\\/]test[\\\/]util[\\\/]lib[\\\/]faker\.js$/
    }),
  ],
  devServer: {
    port: Number(process.env.PORT) || 3030,
    hot: true,
    client: {
      overlay: {
        runtimeErrors: (error) => {
          const message = error?.message ?? String(error);
          // Benign browser warning when layout changes during ResizeObserver callbacks
          // (common when Valdi web renders a large image preview after file pick).
          if (/ResizeObserver loop/i.test(message)) {
            return false;
          }
          return true;
        },
      },
    },
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    modules: [ayabWebSrcPath, path.resolve(__dirname, 'node_modules')],
    symlinks: false,
    alias: {
      ayab_web: ayabWebPath,
    },
  },
  module: {
    rules: [
      { test: /\.(sa|sc|c)ss$/, use: ["style-loader", "css-loader", "sass-loader"] },
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: { 
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: { esmodules: true } }],
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
      // BEGIN REQUIRED FOR VALDI WEB
      // (url-loader is deprecated in webpack 5; asset modules work too, but keeping as-is if you need)
      { test: /\.(png|woff|woff2|eot|ttf|svg)$/, loader: "url-loader", options: { limit: false } },
      { test: /\.protodecl$/, type: 'asset/resource' },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: { appendTsxSuffixTo: [/\.vue$/], transpileOnly: true },
      },
      // END REQUIRED FOR VALDI WEB
    ],
  },
};

