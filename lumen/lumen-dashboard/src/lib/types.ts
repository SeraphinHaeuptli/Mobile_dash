/**
 * Core contract for the dashboard. Everything else builds on these types.
 * Connectors live in src/connectors/<id>/ and export:
 *   server.ts   -> `const connector: ConnectorServer` (default export)
 *   widgets.tsx -> `const widgets: WidgetModule[]` (default export)
 */

export type Json = unknown;

export type WidgetSettings = Record<string, string | number | boolean>;

export interface WidgetSettingField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  /** only for type: 'select' */
  options?: { label: string; value: string }[];
  placeholder?: string;
  help?: string;
  default?: string | number | boolean;
}

export interface ConnectorMeta {
  /** stable id, matches the folder name, e.g. 'stripe' */
  id: string;
  name: string;
  description: string;
  /** single emoji used as the connector glyph */
  icon: string;
  /** hex accent colour used for the widget header dot */
  accent: string;
  /** env vars required to leave mock mode, e.g. ['STRIPE_SECRET_KEY'] */
  envKeys: string[];
  docsUrl?: string;
}

/** What a connector handler resolves to: the data plus how it was obtained. */
export interface WidgetResult<T = Json> {
  data: T;
  /** 'live' = fetched now, 'mock' = no credentials configured, 'stale' = live call
   *  failed and this is mock data standing in — see `warning` for why. */
  mode: 'live' | 'mock' | 'stale';
  /** set only when mode is 'stale'; the reason the live call failed, e.g. 'Stripe 401' */
  warning?: string;
}

/** Server-side half of a connector: turns (widgetId, settings) into data. */
export interface ConnectorServer {
  meta: ConnectorMeta;
  /** true when every env key is present -> live data, otherwise mock data */
  isLive(): boolean;
  /** keyed by widget id, e.g. 'stripe.balance' */
  handlers: Record<string, (settings: WidgetSettings) => Promise<WidgetResult>>;
}

export interface WidgetDef {
  /** '<connectorId>.<name>', e.g. 'github.activity' */
  id: string;
  connectorId: string;
  title: string;
  description: string;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  settings?: WidgetSettingField[];
  /** auto-refresh interval; 0 or undefined = manual refresh only */
  refreshSeconds?: number;
}

/** Props every widget component receives. */
export interface WidgetProps<T = Json> {
  data: T;
  settings: WidgetSettings;
  /** 'mock' when the connector has no credentials configured */
  mode: 'mock' | 'live';
}

/** Client-side half of a widget: the definition plus its React component. */
export interface WidgetModule {
  def: WidgetDef;
  Component: (props: WidgetProps<never>) => JSX.Element;
}

/** What /api/widget/[id] returns. */
export interface WidgetResponse {
  ok: boolean;
  data?: Json;
  error?: string;
  mode: 'mock' | 'live' | 'stale';
  /** set only when mode is 'stale'; the reason the live call failed */
  warning?: string;
  fetchedAt: string;
}

/** Persisted dashboard state (data/layout.json). */
export interface DashboardItem {
  /** unique instance id (a widget can be placed more than once) */
  i: string;
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  settings: WidgetSettings;
  title?: string;
}

export interface DashboardConfig {
  version: 1;
  theme: string;
  accent: string;
  columns: number;
  items: DashboardItem[];
}
