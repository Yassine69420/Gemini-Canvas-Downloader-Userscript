// ==UserScript==
// @name         Gemini Canvas Downloader
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Download Gemini Canvas code with smart detection, multi-file support, and enhanced reliability
// @author       itsYazyn
// @match        https://gemini.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        unsafeWindow
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const BUTTON_ID = 'gemini-canvas-dl-btn';

    // Enhanced file type detection with better accuracy
    const FILE_TYPE_PATTERNS = [
        // Web Technologies (Higher priority for specific patterns)
        { patterns: ['<!DOCTYPE html>', '<html', '<head', '<body', '<meta'], ext: '.html', priority: 10 },
        { patterns: ['import React', 'from "react"', "from 'react'", 'useState', 'useEffect'], ext: '.jsx', priority: 9 },
        { patterns: ['import React', 'interface Props', ': React.FC', 'React.Component'], ext: '.tsx', priority: 9 },
        { patterns: ["from '@angular", '<ng-', 'ngOnInit', '@Component', '@Injectable'], ext: '.ts', priority: 9 },
        { patterns: ['<template>', '<script setup>', 'defineProps', 'ref(', 'reactive('], ext: '.vue', priority: 9 },
        { patterns: ['<script>', 'onMount(', 'export let ', '$:', 'writable('], ext: '.svelte', priority: 9 },
        { patterns: ['@tailwind', '@apply', '@layer', 'theme('], ext: '.css', priority: 9 },
        { patterns: ['@import', '@mixin', '@include', '$variable', '@function'], ext: '.scss', priority: 8 },
        { patterns: ['@import', '@media', 'calc(', 'var(--', ':root {'], ext: '.css', priority: 7 },
        { patterns: ['async ', 'await ', 'Promise', '.then(', 'export default'], ext: '.js', priority: 6 },
        { patterns: ['interface ', 'type ', ': string', ': number', 'enum ', 'as '], ext: '.ts', priority: 7 },

        // Backend Languages
        { patterns: ['def __init__', 'class ', '@dataclass', 'async def ', 'typing.'], ext: '.py', priority: 9 },
        { patterns: ['def ', 'import ', 'from ', 'if __name__', 'print('], ext: '.py', priority: 8 },
        { patterns: ['public class ', 'private ', 'public static void main', '@Override', '@Autowired'], ext: '.java', priority: 8 },
        { patterns: ['package main', 'func ', 'import "', 'defer ', 'go func'], ext: '.go', priority: 8 },
        { patterns: ['fn main()', 'let mut ', 'impl ', 'pub struct', 'Result<'], ext: '.rs', priority: 9 },
        { patterns: ['fn ', 'use std::', '&str', 'Vec<', 'Option<'], ext: '.rs', priority: 8 },
        { patterns: ['#include <iostream>', 'std::', 'namespace ', 'template<'], ext: '.cpp', priority: 9 },
        { patterns: ['#include <', 'cout <<', 'endl', 'class ', 'virtual '], ext: '.cpp', priority: 8 },
        { patterns: ['#include <stdio.h>', 'int main(', 'printf(', 'malloc('], ext: '.c', priority: 8 },
        { patterns: ['<?php', 'namespace ', 'use ', '<?=', '->'], ext: '.php', priority: 9 },
        { patterns: ['require ', 'def ', 'attr_accessor', 'do |', '@'], ext: '.rb', priority: 7 },
        { patterns: ['fun main()', 'data class', 'sealed class', 'companion object'], ext: '.kt', priority: 9 },
        { patterns: ['import Foundation', 'func ', '@Published', 'ObservableObject'], ext: '.swift', priority: 8 },
        { patterns: ['using System', 'namespace ', 'class ', 'static void Main'], ext: '.cs', priority: 8 },

        // Scripting & Shell
        { patterns: ['#!/bin/bash', '#!/bin/sh', 'if [ ', 'elif [ ', 'fi\n'], ext: '.sh', priority: 10 },
        { patterns: ['#!/usr/bin/env python'], ext: '.py', priority: 11 },
        { patterns: ['#!/usr/bin/env node'], ext: '.js', priority: 11 },
        { patterns: ['param(', 'Write-Host', '$_', 'ForEach-Object'], ext: '.ps1', priority: 9 },

        // Data & Config
        { patterns: ['"use strict"', 'module.exports', 'require('], ext: '.js', priority: 7 },
        { patterns: ['apiVersion:', 'kind:', 'metadata:', 'spec:', 'kubectl'], ext: '.yaml', priority: 9 },
        { patterns: ['---\n', 'key: value', '  - item'], ext: '.yaml', priority: 6 },
        { patterns: ['<?xml version', 'xmlns:', '<root>'], ext: '.xml', priority: 8 },
        { patterns: ['<dependencies>', '<groupId>', '<artifactId>'], ext: '.xml', priority: 9 },

        // Database
        { patterns: ['SELECT * FROM', 'CREATE TABLE', 'ALTER TABLE', 'BEGIN TRANSACTION'], ext: '.sql', priority: 9 },
        { patterns: ['SELECT ', 'INSERT INTO', 'UPDATE ', 'DELETE FROM'], ext: '.sql', priority: 8 },
        { patterns: ['db.collection', 'db.find(', 'aggregate(['], ext: '.js', priority: 7 },

        // Documentation & Markup
        { patterns: ['# ', '## ', '```', '[link](', '**bold**'], ext: '.md', priority: 7 },
        { patterns: ['\\documentclass', '\\begin{document}', '\\maketitle'], ext: '.tex', priority: 10 },
        { patterns: ['$$', '\\[', '\\frac{', '\\int_'], ext: '.tex', priority: 8 },
        { patterns: ['.. code-block::', '===', '---', ':ref:'], ext: '.rst', priority: 8 },

        // Scientific & Statistical
        { patterns: ['library(', 'ggplot(', 'data.frame(', '<-', '%>%'], ext: '.r', priority: 8 },
        { patterns: ['function ', 'end\n', 'fprintf(', 'disp('], ext: '.m', priority: 7 },
        { patterns: ['import numpy', 'import pandas', 'import matplotlib'], ext: '.py', priority: 9 },

        // DevOps & Infrastructure
        { patterns: ['FROM ', 'RUN ', 'COPY ', 'WORKDIR ', 'ENV '], ext: '.dockerfile', priority: 10 },
        { patterns: ['resource "', 'provider "', 'variable "', 'output "'], ext: '.tf', priority: 9 },
        { patterns: ['- name:', '  hosts:', '  tasks:', '  become:'], ext: '.yaml', priority: 8 },

        // Config files
        { patterns: ['[dependencies]', '[dev-dependencies]', 'cargo.toml'], ext: '.toml', priority: 9 },
        { patterns: ['"scripts":', '"dependencies":', '"devDependencies":'], ext: '.json', priority: 7 },
        { patterns: ['extends:', 'plugins:', 'rules:', 'env:'], ext: '.json', priority: 6 },

        // Generic JSON (lower priority)
        { patterns: ['{', '"', '}'], ext: '.json', priority: 3, validator: isValidJSON },
    ];

    // Validators
    function isValidJSON(content) {
        try {
            JSON.parse(content.trim());
            return true;
        } catch (e) {
            return false;
        }
    }

    // Enhanced file type detection with better scoring
    function detectFileType(content) {
        const trimmedContent = content.trim();
        const lowerContent = content.toLowerCase();
        const firstLine = trimmedContent.split('\n')[0].toLowerCase();

        let bestMatch = null;
        let highestScore = 0;

        for (const rule of FILE_TYPE_PATTERNS) {
            let matchCount = 0;
            let firstLineBonus = 0;

            for (const pattern of rule.patterns) {
                const lowerPattern = pattern.toLowerCase();

                // Check if pattern exists in content
                if (lowerContent.includes(lowerPattern)) {
                    matchCount++;

                    // Bonus points if pattern is in first line
                    if (firstLine.includes(lowerPattern)) {
                        firstLineBonus += 2;
                    }

                    // Bonus points if pattern is at the start
                    if (trimmedContent.substring(0, 100).toLowerCase().includes(lowerPattern)) {
                        firstLineBonus += 1;
                    }
                }
            }

            if (matchCount > 0) {
                // Validate if validator exists
                if (rule.validator && !rule.validator(trimmedContent)) {
                    continue;
                }

                const score = (matchCount * (rule.priority || 5)) + firstLineBonus;
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = rule.ext;
                }
            }
        }

        // Smart fallback with context awareness
        if (!bestMatch) {
            if (trimmedContent.startsWith('{') && isValidJSON(trimmedContent)) {
                bestMatch = '.json';
            } else if (trimmedContent.startsWith('[') && isValidJSON(trimmedContent)) {
                bestMatch = '.json';
            } else if (trimmedContent.match(/^#+ /m)) {
                bestMatch = '.md';
            } else if (trimmedContent.includes('function') && trimmedContent.includes('{')) {
                bestMatch = '.js';
            } else {
                bestMatch = '.txt';
            }
        }

        return bestMatch;
    }

    // Extract code from Monaco Editor with retry logic
    function extractFromMonaco() {
        const monaco = (typeof unsafeWindow !== 'undefined' && unsafeWindow.monaco) ? unsafeWindow.monaco : window.monaco;

        if (!monaco?.editor) return null;

        const models = monaco.editor.getModels();
        if (models.length === 0) return null;

        // Get the last model (usually the active one)
        const model = models[models.length - 1];
        const content = model.getValue();

        // Verify content is substantial
        if (content && content.trim().length > 10) {
            return content;
        }

        return null;
    }

    // Extract code from DOM with improved selectors
    function extractFromDOM() {
        const selectors = [
            '.monaco-editor .view-lines',
            'xap-code-editor .view-lines',
            '.code-editor-content',
            'code.language-javascript',
            'code.language-python',
            'code.language-html',
            'pre code'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.innerText.trim().length > 50) {
                return element.innerText;
            }
        }

        return null;
    }

    // Extract title with improved logic
    function extractCanvasTitle() {
        const selectors = [
            'h2.title-text.gds-title-s',
            'h2.title-text',
            '[data-test-id*="canvas-title"]',
            '.canvas-title',
            'h2[role="heading"]',
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (!element) continue;

            const rect = element.getBoundingClientRect();
            // Must be in right half and visible
            if (rect.left > (window.innerWidth / 2) && rect.width > 0) {
                const text = element.innerText.trim();
                if (text.length > 0 && text.length < 100) {
                    return text;
                }
            }
        }

        return 'gemini_canvas_code';
    }

    // Clean filename
    function sanitizeFilename(name) {
        return name
            .replace(/[^a-z0-9\-_\s]/gi, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .toLowerCase()
            .substring(0, 100); // Limit length
    }

    // Main download handler
    function handleDownload() {
        let content = '';
        let source = '';

        // Try multiple extraction methods
        content = extractFromMonaco();
        if (content) {
            source = 'Monaco Editor';
        } else {
            // Check for user selection
            const selection = window.getSelection().toString();
            if (selection && selection.length > 50) {
                content = selection;
                source = 'User Selection';
            } else {
                content = extractFromDOM();
                if (content) {
                    source = 'DOM';
                }
            }
        }

        // Verification
        if (!content || content.trim().length < 10) {
            showNotification(
                '⚠️ Unable to extract code',
                'Try selecting all code (Ctrl+A / Cmd+A) and click download again.',
                'warning'
            );
            return;
        }

        // Get filename
        const title = extractCanvasTitle();
        const cleanTitle = sanitizeFilename(title);
        const ext = detectFileType(content);
        const filename = `${cleanTitle}${ext}`;

        // Download
        downloadFile(content, filename);

        // Success notification
        showNotification(
            '✅ Download Complete',
            `File: ${filename}\nSource: ${source}\nSize: ${formatBytes(content.length)}`,
            'success'
        );
    }

    // Download file
    function downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Format bytes
    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // Show notification
    function showNotification(title, message, type = 'info') {
        // Try GM_notification first
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                title: title,
                text: message,
                timeout: 3000
            });
        } else {
            // Fallback to console
            console.log(`${title}\n${message}`);

            // Also try browser notification if available
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { body: message });
            }
        }
    }

    // Inject download button into menu
    function injectMenuItem() {
        const menuPanels = document.querySelectorAll('.mat-mdc-menu-panel');

        menuPanels.forEach(panel => {
            // Skip if already has download button
            if (panel.querySelector(`#${BUTTON_ID}`)) return;

            const shareButton = panel.querySelector('[data-test-id="share-button"]');
            const copyButton = panel.querySelector('[data-test-id="copy-button"]');

            // Check if this is the conversation actions menu (has rename/delete buttons)
            const hasRenameButton = panel.querySelector('[data-test-id="rename-button"]');
            const hasDeleteButton = panel.querySelector('[data-test-id="delete-button"]');
            const hasPinButton = panel.querySelector('[data-test-id="pin-button"]');

            // Skip conversation actions menu - only inject in Canvas menu
            if (hasRenameButton || hasDeleteButton || hasPinButton) {
                return;
            }

            // Only inject if we have copy button (Canvas menu indicator)
            if (copyButton && !panel.querySelector(`#${BUTTON_ID}`)) {
                const menuContent = panel.querySelector('.mat-mdc-menu-content');
                if (!menuContent) return;

                // Create download button
                const downloadWrapper = document.createElement('div');
                downloadWrapper.className = 'ng-star-inserted';
                downloadWrapper.id = BUTTON_ID;

                const btn = document.createElement('button');
                btn.className = 'mat-mdc-menu-item mat-focus-indicator menu-item-button ng-star-inserted';
                btn.setAttribute('mat-menu-item', '');
                btn.setAttribute('data-test-id', 'download-button');
                btn.setAttribute('role', 'menuitem');
                btn.setAttribute('tabindex', '0');
                btn.setAttribute('aria-disabled', 'false');

                btn.innerHTML = `
                    <mat-icon role="img" fonticon="download" class="mat-icon notranslate gds-icon-l google-symbols mat-ligature-font mat-icon-no-color" aria-hidden="true">
                        download
                    </mat-icon>
                    <span class="mat-mdc-menu-item-text">Download code</span>
                    <div matripple="" class="mat-ripple mat-mdc-menu-ripple"></div>
                `;

                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDownload();

                    // Close menu
                    const backdrop = document.querySelector('.cdk-overlay-backdrop');
                    if (backdrop) backdrop.click();
                };

                downloadWrapper.appendChild(btn);

                // Insert after copy button
                copyButton.parentElement.after(downloadWrapper);
            }
        });
    }

    // Add keyboard shortcut (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            handleDownload();
        }
    });

    // Start observer
    function startObserver() {
        const observer = new MutationObserver(() => {
            injectMenuItem();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Initialize
    startObserver();
    console.log('✅ Gemini Canvas Downloader v3.0 - Loaded!');
    console.log('💡 Tip: Use Ctrl+Shift+D to quickly download code');

})();
