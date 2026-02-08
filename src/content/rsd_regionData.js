/**
 * File: rsd_regionData.js
 * 
 * Part of the RoServerTools project.
 * 
 * This file implements part of the client-side logic used by the RoServerTools
 * Chrome extension. It contains concrete implementation code that supports
 * Roblox server tooling features exposed through the extension UI.
 * 
 * The responsibilities of this file are limited to its own scope and are
 * intended to be readable, maintainable, and suitable for long-term maintenance.
 * Detailed feature behavior and usage expectations are documented in the README.
 */

var defaultRegions = [
  "SG", "DE", "FR", "JP", "BR", "NL", "PL", "US-CA", "US-VA", "US-IL", "US-TX", "US-FL", "US-NY", "US-WA", "US-GA", "AU", "GB", "IN", "HK",
];

function normalizeRegionCode(code) {
  if (code == null) return code;
  return String(code).trim().toUpperCase();
}

var regionCoordinates = {
  SG: {
    latitude: 1.3521,
    longitude: 103.8198,
    city: "Singapore",
    state: null,
    country: "Singapore",
  },
  DE: {
    latitude: 50.1109,
    longitude: 8.6821,
    city: "Frankfurt",
    state: null,
    country: "Germany",
  },
  FR: {
    latitude: 48.8566,
    longitude: 2.3522,
    city: "Paris",
    state: null,
    country: "France",
  },
  JP: {
    latitude: 35.6895,
    longitude: 139.6917,
    city: "Tokyo",
    state: null,
    country: "Japan",
  },
  BR: {
    latitude: -14.235,
    longitude: -51.9253,
    city: "Not Yet Available",
    state: null,
    country: "Brazil",
  },
  NL: {
    latitude: 52.3676,
    longitude: 4.9041,
    city: "Amsterdam",
    state: null,
    country: "Netherlands",
  },
  PL: {
    latitude: 52.237049,
    longitude: 21.017532,
    city: "Warsaw",
    state: null,
    country: "Poland",
  },
  HK: {
    latitude: 22.396428,
    longitude: 114.109497,
    city: "Hong Kong",
    state: null,
    country: "China",
  },

  "US-CA": {
    latitude: 34.0522,
    longitude: -118.2437,
    city: "LA",
    state: "California",
    includeState: true,
    country: "USA",
  },
  "US-VA": {
    latitude: 38.9577,
    longitude: -77.1445,
    city: "Ashburn",
    state: "Virginia",
    includeState: true,
    country: "USA",
  },
  "US-IL": {
    latitude: 41.8781,
    longitude: -87.6298,
    city: "Chicago",
    state: "Illinois",
    includeState: true,
    country: "USA",
  },
  "US-TX": {
    latitude: 32.7767,
    longitude: -96.797,
    city: "Dallas",
    state: "Texas",
    includeState: true,
    country: "USA",
  },
  "US-FL": {
    latitude: 25.7617,
    longitude: -80.1918,
    city: "Miami",
    state: "Florida",
    includeState: true,
    country: "USA",
  },
  "US-NY": {
    latitude: 40.7128,
    longitude: -74.006,
    city: "NYC",
    state: "New York",
    includeState: true,
    country: "USA",
  },
  "US-WA": {
    latitude: 47.6062,
    longitude: -122.3321,
    city: "Seattle",
    state: "Washington",
    includeState: true,
    country: "USA",
  },
  "US-GA": {
    latitude: 33.749,
    longitude: -84.388,
    city: "Atlanta",
    state: "Georgia",
    includeState: true,
    country: "USA",
  },

  AU: {
    latitude: -33.8688,
    longitude: 151.2093,
    city: "Sydney",
    state: null,
    country: "Australia",
  },
  GB: {
    latitude: 51.5074,
    longitude: -0.1278,
    city: "London",
    state: null,
    country: "United Kingdom",
  },
  IN: {
    latitude: 19.076,
    longitude: 72.8777,
    city: "Mumbai",
    state: null,
    country: "India",
  },
};
