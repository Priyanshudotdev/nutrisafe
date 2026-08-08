# UI Design Principles

## Core Technologies
- React Native / Expo
- Tailwind CSS (via Uniwind / NativeWind)
- HeroUI Native

## HeroUI Native Setup Guidelines
1. **Providers**: Wrap the application (`app/_layout.tsx`) with `<GestureHandlerRootView style={{ flex: 1 }}>` and `<HeroUINativeProvider>`.
2. **CSS Configuration**: `global.css` must include:
   ```css
   @import 'tailwindcss';
   @import 'uniwind';
   @import 'heroui-native/styles';
   ```
3. **Bundle Optimization**: ALWAYS use granular imports to reduce bundle size:
   - ✅ `import { Button } from "heroui-native/button";`
   - ❌ `import { Button } from "heroui-native";`
   
   Available granular exports:
   - `heroui-native/provider` - Provider component
   - `heroui-native/provider-raw` - Lightweight provider
   - `heroui-native/[component-name]` - Individual components
   - `heroui-native/portal` - Portal utilities
   - `heroui-native/toast` - Toast provider and utilities
   - `heroui-native/utils` - Utility functions
   - `heroui-native/hooks` - Custom hooks

## Design Reference
- Refer to `assets/stitch_nutrisafe_assistant` for layout and aesthetic references.
- Utilize Magic UI / HeroUI native components for all possible UI elements to maintain a premium, dynamic, and cohesive look.
