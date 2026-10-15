import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ComponentType } from "react";
import { Icon, Loading, type IconName } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors, fonts } from "../theme";
import { IndicatorsScreen } from "../screens/admin/IndicatorsScreen";
import { MerchantsScreen } from "../screens/admin/MerchantsScreen";
import { ZonesScreen } from "../screens/admin/ZonesScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { CommunitiesScreen } from "../screens/merchant/CommunitiesScreen";
import { CreateOrderScreen } from "../screens/merchant/CreateOrderScreen";
import { HomeScreen } from "../screens/merchant/HomeScreen";
import { OrderDetailScreen } from "../screens/merchant/OrderDetailScreen";
import { OrdersScreen } from "../screens/merchant/OrdersScreen";
import { PaymentScreen } from "../screens/merchant/PaymentScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { CatalogScreen } from "../screens/supplier/CatalogScreen";
import { ConsolidatedDetailScreen } from "../screens/supplier/ConsolidatedDetailScreen";
import { ConsolidatedScreen } from "../screens/supplier/ConsolidatedScreen";
import { DashboardScreen } from "../screens/supplier/DashboardScreen";
import { ProductEditScreen } from "../screens/supplier/ProductEditScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

type TabDef = { name: string; label: string; icon: IconName; component: ComponentType<any> };

/** Pestañas por rol (equivalen al Sidebar/BottomNav del prototipo). */
const TABS: Record<string, TabDef[]> = {
  COMERCIANTE: [
    { name: "Inicio", label: "Inicio", icon: "home", component: HomeScreen },
    { name: "Pedidos", label: "Pedidos", icon: "package", component: OrdersScreen },
    { name: "Comunidad", label: "Comunidad", icon: "users", component: CommunitiesScreen },
    { name: "Negocio", label: "Negocio", icon: "shopping-bag", component: ProfileScreen },
  ],
  MAYORISTA: [
    { name: "Resumen", label: "Resumen", icon: "bar-chart-2", component: DashboardScreen },
    { name: "Consolidados", label: "Pedidos", icon: "layers", component: ConsolidatedScreen },
    { name: "Catalogo", label: "Catálogo", icon: "tag", component: CatalogScreen },
    { name: "Empresa", label: "Empresa", icon: "briefcase", component: ProfileScreen },
  ],
  ADMINISTRADOR: [
    { name: "Indicadores", label: "Indicadores", icon: "activity", component: IndicatorsScreen },
    { name: "Comercios", label: "Comercios", icon: "users", component: MerchantsScreen },
    { name: "Zonas", label: "Zonas", icon: "map-pin", component: ZonesScreen },
    { name: "Cuenta", label: "Cuenta", icon: "user", component: ProfileScreen },
  ],
};

function Tabs() {
  const { usuario } = useAuth();
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.brand,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11 },
      tabBarStyle: { borderTopColor: colors.line, height: 64, paddingTop: 6 },
    }}>
      {TABS[usuario!.rol].map((t) => (
        <Tab.Screen key={t.name} name={t.name} component={t.component}
          options={{ tabBarLabel: t.label, tabBarIcon: ({ color }) => <Icon name={t.icon} color={color} size={21} /> }} />
      ))}
    </Tab.Navigator>
  );
}

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.canvas, primary: colors.brand } };

export function Navigation() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Loading />;
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTitleStyle: { fontFamily: fonts.display, color: colors.ink },
        headerTintColor: colors.ink,
        headerBackTitle: "Volver",
      }}>
        {!usuario ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="DetallePedido" component={OrderDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CrearPedido" component={CreateOrderScreen} options={{ title: "Crear pedido" }} />
            <Stack.Screen name="Pago" component={PaymentScreen} options={{ title: "Pagar mi parte", presentation: "modal" }} />
            <Stack.Screen name="Notificaciones" component={NotificationsScreen} options={{ title: "" }} />
            <Stack.Screen name="DetalleConsolidado" component={ConsolidatedDetailScreen} options={{ title: "Pedido consolidado" }} />
            <Stack.Screen name="EditarProducto" component={ProductEditScreen} options={{ title: "Producto" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
