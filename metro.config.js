const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// ⚙️ Fix for .cjs and legacy modules
config.resolver.sourceExts.push("cjs");

module.exports = config;
