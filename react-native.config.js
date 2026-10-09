// Keep native linking aligned with Worklets' redirected generated output.
module.exports = {
  dependencies: {
    "react-native-worklets": {
      platforms: {
        android: {
          cmakeListsPath: "build-gabai/generated/source/codegen/jni/CMakeLists.txt",
        },
      },
    },
  },
};
