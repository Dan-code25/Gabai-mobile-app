/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        nunito: ["Nunito-Regular"],
        "nunito-semibold": ["Nunito-SemiBold"],
        "nunito-bold": ["Nunito-Bold"],
        "nunito-extrabold": ["Nunito-ExtraBold"],
      },
      colors: {
        gabai: {
          cream: "#FFF7F1",
          ink: "#111135",
          muted: "#64638B",
          purple: "#5940ED",
          lavender: "#ECE7FF",
          coral: "#FF715B",
        },
      },
    },
  },
  plugins: [],
};
