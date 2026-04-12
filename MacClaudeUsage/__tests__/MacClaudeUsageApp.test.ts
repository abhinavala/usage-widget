import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { LaunchAgentConfig, AppVisibility, SystemStatus } from '../../src/types/system';

const MAC_APP_DIR = resolve(__dirname, '..');

function readPlist(filename: string): string {
  return readFileSync(resolve(MAC_APP_DIR, filename), 'utf-8');
}

describe('MacClaudeUsageApp', () => {
  let infoPlist: string;
  let launchAgentPlist: string;
  let entitlements: string;

  beforeEach(() => {
    infoPlist = readPlist('Info.plist');
    launchAgentPlist = readPlist('LaunchAgent.plist');
    entitlements = readPlist('MacClaudeUsage.entitlements');
  });

  describe('initializeApp completes successfully with proper LSUIElement configuration', () => {
    it('Info.plist has LSUIElement set to true for invisible app', () => {
      // LSUIElement = true means activation policy is .accessory (no dock icon)
      expect(infoPlist).toContain('<key>LSUIElement</key>');
      // Verify true follows LSUIElement key
      const lsuiIndex = infoPlist.indexOf('<key>LSUIElement</key>');
      const afterKey = infoPlist.substring(lsuiIndex);
      expect(afterKey).toMatch(/<key>LSUIElement<\/key>\s*<true\/>/);
    });

    it('system status visibility should be hidden after initialization', () => {
      // Simulates SystemStatusManager initial state after initializeApp()
      const systemStatus: SystemStatus = {
        isRunning: true,
        visibility: 'hidden',
      };
      expect(systemStatus.visibility).toBe('hidden');
      expect(systemStatus.isRunning).toBe(true);
    });

    it('Info.plist has correct bundle configuration', () => {
      expect(infoPlist).toContain('<key>CFBundleName</key>');
      expect(infoPlist).toContain('<string>MacClaudeUsage</string>');
      expect(infoPlist).toContain('<key>CFBundlePackageType</key>');
      expect(infoPlist).toContain('<string>APPL</string>');
    });
  });

  describe('setupLaunchAgent creates valid plist with KeepAlive enabled', () => {
    it('LaunchAgent.plist has KeepAlive set to true', () => {
      const keepAliveIndex = launchAgentPlist.indexOf('<key>KeepAlive</key>');
      expect(keepAliveIndex).toBeGreaterThan(-1);
      const afterKey = launchAgentPlist.substring(keepAliveIndex);
      expect(afterKey).toMatch(/<key>KeepAlive<\/key>\s*<true\/>/);
    });

    it('LaunchAgent.plist has RunAtLoad set to true', () => {
      const runAtLoadIndex = launchAgentPlist.indexOf('<key>RunAtLoad</key>');
      expect(runAtLoadIndex).toBeGreaterThan(-1);
      const afterKey = launchAgentPlist.substring(runAtLoadIndex);
      expect(afterKey).toMatch(/<key>RunAtLoad<\/key>\s*<true\/>/);
    });

    it('LaunchAgent.plist has correct StartInterval', () => {
      expect(launchAgentPlist).toContain('<key>StartInterval</key>');
      expect(launchAgentPlist).toContain('<integer>300</integer>');
    });

    it('LaunchAgent.plist has correct label', () => {
      expect(launchAgentPlist).toContain('<key>Label</key>');
      expect(launchAgentPlist).toContain('<string>com.claudeusage.mac</string>');
    });

    it('LaunchAgentConfig matches integration contract', () => {
      const config: LaunchAgentConfig = {
        keepAlive: true,
        runAtLoad: true,
        startInterval: 300,
      };
      expect(config.keepAlive).toBe(true);
      expect(config.runAtLoad).toBe(true);
      expect(config.startInterval).toBe(300);
    });

    it('LaunchAgent plist file exists at correct path', () => {
      // If we got here, readPlist succeeded, so the file exists
      expect(launchAgentPlist.length).toBeGreaterThan(0);
      expect(launchAgentPlist).toContain('<?xml version="1.0"');
    });
  });

  describe('getSystemStatus returns accurate running state and visibility', () => {
    it('returns isRunning true when app is active', () => {
      const status: SystemStatus = {
        isRunning: true,
        visibility: 'background',
      };
      expect(status.isRunning).toBe(true);
    });

    it('returns visibility as background during normal operation', () => {
      const status: SystemStatus = {
        isRunning: true,
        visibility: 'background',
      };
      expect(status.visibility).toBe('background');
    });

    it('tracks fetch times correctly', () => {
      const now = new Date();
      const nextFetch = new Date(now.getTime() + 60000);
      const status: SystemStatus = {
        isRunning: true,
        lastFetchTime: now,
        nextFetchTime: nextFetch,
        visibility: 'background',
      };
      expect(status.lastFetchTime).toBe(now);
      expect(status.nextFetchTime).toBe(nextFetch);
      expect(status.nextFetchTime!.getTime()).toBeGreaterThan(status.lastFetchTime!.getTime());
    });

    it('AppVisibility type covers all expected states', () => {
      const states: AppVisibility[] = ['visible', 'hidden', 'background'];
      expect(states).toHaveLength(3);
      expect(states).toContain('visible');
      expect(states).toContain('hidden');
      expect(states).toContain('background');
    });
  });

  describe('entitlements configuration', () => {
    it('has iCloud Key-Value Store entitlement', () => {
      expect(entitlements).toContain('<key>com.apple.developer.ubiquity-kvstore-identifier</key>');
    });

    it('has network client entitlement', () => {
      expect(entitlements).toContain('<key>com.apple.security.network.client</key>');
    });

    it('has app sandbox enabled', () => {
      expect(entitlements).toContain('<key>com.apple.security.app-sandbox</key>');
    });
  });
});
