import { NativeTabs } from 'expo-router/native-tabs';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor="#FFFFFF"
      indicatorColor="#EAF3EC"
      labelStyle={{ selected: { color: '#287A4B' } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="learn">
        <NativeTabs.Trigger.Label>Learn</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book.closed.fill" md="menu_book" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rewards">
        <NativeTabs.Trigger.Label>Rewards</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gift.fill" md="card_giftcard" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shop">
        <NativeTabs.Trigger.Label>Shop</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bag.fill" md="shopping_bag" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wallet">
        <NativeTabs.Trigger.Label>Wallet</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="creditcard.fill" md="account_balance_wallet" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
