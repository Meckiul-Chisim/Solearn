import type { ComponentRef, Ref } from 'react';
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild><TabButton>Home</TabButton></TabTrigger>
          <TabTrigger name="learn" href="/learn" asChild><TabButton>Learn</TabButton></TabTrigger>
          <TabTrigger name="rewards" href="/rewards" asChild><TabButton>Rewards</TabButton></TabTrigger>
          <TabTrigger name="shop" href="/shop" asChild><TabButton>Shop</TabButton></TabTrigger>
          <TabTrigger name="wallet" href="/wallet" asChild><TabButton>Wallet</TabButton></TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ref, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} ref={ref as unknown as Ref<ComponentRef<typeof Pressable>>} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type={isFocused ? 'backgroundSelected' : 'backgroundElement'} style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>{children}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>SoloEarn</ThemedText>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: { position: 'absolute', width: '100%', padding: Spacing.three, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  innerContainer: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, borderRadius: Spacing.five, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexGrow: 1, gap: Spacing.one, maxWidth: MaxContentWidth },
  brandText: { marginRight: 'auto', color: Colors.light.text },
  pressed: { opacity: 0.7 },
  tabButtonView: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.three },
});
