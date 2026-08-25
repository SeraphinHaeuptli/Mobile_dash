/**
 * Client-safe connector metadata.
 *
 * The server halves (src/connectors/<id>/server.ts) import Node builtins, so they can
 * never be pulled into a client bundle. This file mirrors their `meta` for the UI.
 * Adding a connector? Add its entry here too — see README "Adding a connector".
 */
import type { ConnectorMeta } from './types';

export const CONNECTORS: ConnectorMeta[] = [
  { id: 'stripe',  name: 'Stripe',          description: 'Balance, gross volume and recent payments.',            icon: '💳', accent: '#635bff', envKeys: ['STRIPE_SECRET_KEY'],     docsUrl: 'https://stripe.com/docs/api' },
  { id: 'gcal',    name: 'Google Calendar', description: 'Upcoming events and a countdown to whatever is next.',  icon: '📅', accent: '#4285f4', envKeys: ['GOOGLE_CALENDAR_TOKEN'], docsUrl: 'https://developers.google.com/calendar/api' },
  { id: 'gmail',   name: 'Gmail',           description: 'Unread count and the newest matching threads.',         icon: '✉️', accent: '#ea4335', envKeys: ['GMAIL_TOKEN'],           docsUrl: 'https://developers.google.com/gmail/api' },
  { id: 'github',  name: 'GitHub',          description: 'Recent activity, repositories and contributions.',      icon: '⌥',  accent: '#8b5cf6', envKeys: ['GITHUB_TOKEN'],          docsUrl: 'https://docs.github.com/en/rest' },
  { id: 'weather', name: 'Weather',         description: 'Conditions and a five-day outlook. No API key needed.', icon: '☀',  accent: '#38bdf8', envKeys: [],                        docsUrl: 'https://open-meteo.com/en/docs' },
  { id: 'rss',     name: 'RSS',             description: 'Headlines from any RSS or Atom feed.',                  icon: '📰', accent: '#f97316', envKeys: [],                        docsUrl: 'https://www.rssboard.org/rss-specification' },
  { id: 'system',  name: 'System',          description: 'CPU, memory, disks, GPU and processes of this machine.', icon: '🖥', accent: '#22c55e', envKeys: [],                        docsUrl: 'https://nodejs.org/api/os.html' },
];

export const connectorById = (id: string) => CONNECTORS.find((c) => c.id === id);
