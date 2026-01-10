// ==UserScript==
// @name         Gemini Copy Optimizer (Canvas + Deep Research)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Lightweight, efficient copy for Gemini Canvas & Deep Research - eliminates lag and high CPU usage
// @author       ItsYazyne
// @match        https://gemini.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        unsafeWindow
// @grant        GM_notification
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const DEBOUNCE_MS = 300;
    let lastCopyTime = 0;

    // ============ CANVAS CODE EXTRACTION ============
    
    function extractCanvasCode() {
        try {
            // Method 1: Monaco Editor API (most efficient)
            const monaco = (typeof unsafeWindow !== 'undefined' && unsafeWindow.monaco) ? unsafeWindow.monaco : window.monaco;
            
            if (monaco?.editor) {
                const models = monaco.editor.getModels();
                if (models.length > 0) {
                    const content = models[models.length - 1].getValue();
                    if (content?.trim().length > 5) return content;
                }
            }

            // Method 2: DOM fallback (minimal)
            const selectors = ['.monaco-editor .view-lines', 'xap-code-editor .view-lines'];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el?.innerText?.trim().length > 5) {
                    return el.innerText;
                }
            }
        } catch (e) {
            console.error('Canvas extraction error:', e);
        }
        return null;
    }

    // ============ DEEP RESEARCH EXTRACTION ============
    
    function extractDeepResearch() {
        try {
            // Priority 1: Deep Research result canvas (the actual report)
            const resultCanvas = document.querySelector('#extended-response-message-content .structured-content-container');
            if (resultCanvas) {
                const text = resultCanvas.innerText || resultCanvas.textContent;
                if (text?.trim().length > 100) {
                    return text;
                }
            }

            // Priority 2: Extended response content
            const extendedResponse = document.querySelector('#extended-response-message-content');
            if (extendedResponse) {
                const text = extendedResponse.innerText || extendedResponse.textContent;
                if (text?.trim().length > 100) {
                    return text;
                }
            }

            // Priority 3: Structured content container anywhere
            const structuredContent = document.querySelector('.structured-content-container');
            if (structuredContent) {
                const text = structuredContent.innerText || structuredContent.textContent;
                if (text?.trim().length > 100) {
                    return text;
                }
            }

            // Priority 4: Look for the largest response message (skip research plans)
            const messages = document.querySelectorAll('message-content');
            let largestContent = '';
            
            for (const msg of messages) {
                // Skip if it contains "Research plan" or similar indicators
                const msgText = msg.innerText || msg.textContent || '';
                if (msgText.toLowerCase().includes('research plan') || 
                    msgText.toLowerCase().includes('researching now')) {
                    continue;
                }
                
                if (msgText.length > largestContent.length && msgText.length > 500) {
                    largestContent = msgText;
                }
            }

            if (largestContent.trim().length > 100) {
                return largestContent;
            }

            // Priority 5: General model response (last resort)
            const modelResponse = document.querySelector('.model-response-text');
            if (modelResponse) {
                const text = modelResponse.innerText || modelResponse.textContent;
                if (text?.trim().length > 100) {
                    return text;
                }
            }
        } catch (e) {
            console.error('Deep Research extraction error:', e);
        }
        return null;
    }

    // ============ SMART CONTENT DETECTION ============
    
    function extractContent() {
        // Try Canvas first (if Monaco is present, we're likely in Canvas)
        const canvasContent = extractCanvasCode();
        if (canvasContent) {
            return { content: canvasContent, type: 'Canvas Code' };
        }

        // Try Deep Research
        const researchContent = extractDeepResearch();
        if (researchContent) {
            return { content: researchContent, type: 'Deep Research' };
        }

        // Fallback: Selected text
        const selection = window.getSelection().toString();
        if (selection?.trim().length > 10) {
            return { content: selection, type: 'Selection' };
        }

        return null;
    }

    // ============ OPTIMIZED COPY HANDLER ============
    
    function handleCopy(e) {
        const now = Date.now();
        
        // Debounce to prevent rapid-fire copies
        if (now - lastCopyTime < DEBOUNCE_MS) {
            return;
        }
        lastCopyTime = now;

        // Stop event propagation to prevent built-in handler
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }

        const result = extractContent();

        if (!result) {
            showNotification('⚠️ No content found', 'Unable to extract content', 'warning');
            return;
        }

        // Copy to clipboard (optimized method)
        if (typeof GM_setClipboard !== 'undefined') {
            // Preferred: Direct clipboard access (instant, no DOM)
            GM_setClipboard(result.content, 'text');
            showNotification(
                '✅ Copied!', 
                `${result.type}: ${formatSize(result.content.length)}`,
                'success'
            );
        } else {
            // Fallback: Clipboard API
            copyToClipboard(result.content, result.type);
        }
    }

    // ============ CLIPBOARD METHODS ============
    
    function copyToClipboard(text, type) {
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    showNotification('✅ Copied!', `${type}: ${formatSize(text.length)}`, 'success');
                })
                .catch(() => fallbackCopy(text, type));
        } else {
            fallbackCopy(text, type);
        }
    }

    function fallbackCopy(text, type) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            showNotification('✅ Copied!', `${type}: ${formatSize(text.length)}`, 'success');
        } catch (err) {
            showNotification('❌ Copy failed', 'Unable to copy to clipboard', 'error');
        }
        
        document.body.removeChild(textarea);
    }

    // ============ UTILITIES ============
    
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function showNotification(title, message, type = 'info') {
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                title: title,
                text: message,
                timeout: 2000,
                silent: true
            });
        } else {
            console.log(`${title}: ${message}`);
        }
    }

    // ============ INTERCEPT BUILT-IN COPY BUTTONS ============
    
    function interceptCopyButtons() {
        // Use event delegation for efficiency
        document.body.addEventListener('click', function(e) {
            // Canvas copy button
            const canvasCopy = e.target.closest('[data-test-id="copy-button"]');
            if (canvasCopy) {
                const panel = canvasCopy.closest('.mat-mdc-menu-panel');
                
                // Only intercept Canvas menu copy (not conversation menu)
                const hasRename = panel?.querySelector('[data-test-id="rename-button"]');
                const hasDelete = panel?.querySelector('[data-test-id="delete-button"]');
                
                if (!hasRename && !hasDelete) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    handleCopy(e);
                    
                    // Close menu
                    setTimeout(() => {
                        const backdrop = document.querySelector('.cdk-overlay-backdrop');
                        backdrop?.click();
                    }, 50);
                }
            }

            // Deep Research / Response copy buttons
            const responseCopy = e.target.closest('button[aria-label*="Copy"], button[title*="Copy"]');
            if (responseCopy) {
                // Check if it's in a response container
                const isInResponse = responseCopy.closest('message-content, .model-response-text, .response-container');
                if (isInResponse) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    handleCopy(e);
                }
            }
        }, true); // Capture phase to intercept early
    }

    // ============ VISUAL INDICATORS ============
    
    function addVisualIndicators() {
        const observer = new MutationObserver(() => {
            // Canvas copy buttons
            document.querySelectorAll('[data-test-id="copy-button"]:not(.optimized)').forEach(btn => {
                const panel = btn.closest('.mat-mdc-menu-panel');
                const hasRename = panel?.querySelector('[data-test-id="rename-button"]');
                
                if (!hasRename && panel) {
                    btn.classList.add('optimized');
                    btn.title = 'Copy (Optimized - No Lag)';
                    
                    // Add green indicator
                    if (!btn.querySelector('.opt-indicator')) {
                        const indicator = document.createElement('span');
                        indicator.className = 'opt-indicator';
                        indicator.style.cssText = `
                            position: absolute;
                            top: 2px;
                            right: 2px;
                            width: 6px;
                            height: 6px;
                            background: #34a853;
                            border-radius: 50%;
                            pointer-events: none;
                        `;
                        btn.style.position = 'relative';
                        btn.appendChild(indicator);
                    }
                }
            });

            // Response copy buttons
            document.querySelectorAll('button[aria-label*="Copy"]:not(.optimized), button[title*="Copy"]:not(.optimized)').forEach(btn => {
                const isInResponse = btn.closest('message-content, .model-response-text');
                if (isInResponse) {
                    btn.classList.add('optimized');
                    btn.title = btn.title.replace('Copy', 'Copy (Optimized)');
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ============ KEYBOARD SHORTCUT ============
    
    function addKeyboardShortcut() {
        document.addEventListener('keydown', function(e) {
            // Ctrl+Shift+C or Cmd+Shift+C
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                handleCopy();
            }
        });
    }

    // ============ INITIALIZATION ============
    
    function init() {
        console.log('✅ Gemini Copy Optimizer v1.1 - Loaded!');
        console.log('📋 Supports: Canvas Code + Deep Research Reports');
        console.log('⚡ Benefits: No lag, reduced CPU/RAM usage');
        console.log('⌨️  Shortcut: Ctrl+Shift+C (or Cmd+Shift+C)');
        
        interceptCopyButtons();
        addVisualIndicators();
        addKeyboardShortcut();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
