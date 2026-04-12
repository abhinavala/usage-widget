import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const APP_DIR = resolve(__dirname, '..');

describe('AppConfigurationTests', () => {
  describe('Info.plist configuration', () => {
    const plistContent = readFileSync(resolve(APP_DIR, 'Info.plist'), 'utf-8');

    it('contains required bundle keys', () => {
      expect(plistContent).toContain('CFBundleIdentifier');
      expect(plistContent).toContain('CFBundleDisplayName');
      expect(plistContent).toContain('CFBundleName');
      expect(plistContent).toContain('CFBundleVersion');
      expect(plistContent).toContain('CFBundleShortVersionString');
      expect(plistContent).toContain('CFBundleExecutable');
      expect(plistContent).toContain('CFBundlePackageType');
    });

    it('requires iPhone OS', () => {
      expect(plistContent).toContain('LSRequiresIPhoneOS');
      expect(plistContent).toContain('<true/>');
    });

    it('specifies minimum iOS 16+ deployment target', () => {
      expect(plistContent).toContain('MinimumOSVersion');
      expect(plistContent).toContain('16.0');
    });

    it('includes launch screen configuration', () => {
      expect(plistContent).toContain('UILaunchScreen');
    });

    it('includes scene manifest for SwiftUI lifecycle', () => {
      expect(plistContent).toContain('UIApplicationSceneManifest');
    });
  });

  describe('Entitlements configuration', () => {
    const entitlementsContent = readFileSync(
      resolve(APP_DIR, 'ClaudeUsageApp.entitlements'),
      'utf-8'
    );

    it('includes iCloud Key-Value Store entitlement', () => {
      expect(entitlementsContent).toContain(
        'com.apple.developer.ubiquity-kvstore-identifier'
      );
    });

    it('includes iCloud container identifiers key', () => {
      expect(entitlementsContent).toContain(
        'com.apple.developer.icloud-container-identifiers'
      );
    });

    it('is a valid plist file', () => {
      expect(entitlementsContent).toContain('<?xml version="1.0"');
      expect(entitlementsContent).toContain('<!DOCTYPE plist');
      expect(entitlementsContent).toContain('<plist version="1.0">');
    });
  });

  describe('ClaudeUsageApp entry point', () => {
    const appContent = readFileSync(
      resolve(APP_DIR, 'ClaudeUsageApp.swift'),
      'utf-8'
    );

    it('uses @main attribute for app entry point', () => {
      expect(appContent).toContain('@main');
    });

    it('defines ClaudeUsageApp struct conforming to App protocol', () => {
      expect(appContent).toContain('struct ClaudeUsageApp: App');
    });

    it('imports SwiftUI', () => {
      expect(appContent).toContain('import SwiftUI');
    });

    it('uses WindowGroup scene', () => {
      expect(appContent).toContain('WindowGroup');
    });

    it('launches ContentView as root view', () => {
      expect(appContent).toContain('ContentView()');
    });
  });

  describe('ContentView renders without errors', () => {
    const viewContent = readFileSync(
      resolve(APP_DIR, 'Views/ContentView.swift'),
      'utf-8'
    );

    it('imports SwiftUI', () => {
      expect(viewContent).toContain('import SwiftUI');
    });

    it('defines ContentView struct conforming to View protocol', () => {
      expect(viewContent).toContain('struct ContentView: View');
    });

    it('implements body property returning valid SwiftUI content', () => {
      expect(viewContent).toContain('var body: some View');
    });

    it('includes a preview provider', () => {
      expect(viewContent).toContain('#Preview');
    });

    it('displays app title text', () => {
      expect(viewContent).toContain('"Claude Usage"');
    });
  });
});
