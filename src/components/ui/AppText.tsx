import { Text, type TextProps } from "react-native";

import { homeTheme } from "../../theme/home";

type AppTextProps = TextProps & {
  weight?: keyof typeof homeTheme.fonts;
};

export function AppText({ weight = "regular", style, ...props }: AppTextProps) {
  return (
    <Text
      {...props}
      style={[
        { fontFamily: homeTheme.fonts[weight], color: homeTheme.colors.ink },
        style,
      ]}
    />
  );
}
