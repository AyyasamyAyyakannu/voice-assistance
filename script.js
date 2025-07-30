class ChargebeeBotVoiceAgent {
    constructor() {
        this.geminiApiKey = 'AIzaSyDehBRToO6ikqqABzrgO1veU1fxX3u8aQc';
        this.userType = 'general';
        this.conversationHistory = [];
        this.isListening = false;
        this.isProcessing = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.currentTheme = 'light';
        this.conversationSessions = JSON.parse(localStorage.getItem('chargebeebot-sessions') || '[]');
        this.currentSession = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            messages: []
        };
        
        this.systemPrompt = this.buildSystemPrompt();
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.bindEvents();
        this.updateStatus();
        this.initializeTheme();
        this.initializeKeyboardShortcuts();
        this.checkConnection();
    }

    buildSystemPrompt() {
        return 'You are ChargebeeBot, the official AI agent for Chargebee with 10+ years of deep expertise across all business functions. You embody the voice of a seasoned Chargebee veteran who understands subscription billing inside and out.\n\nCRITICAL RESTRICTIONS:\n- You ONLY answer questions related to Chargebee, subscription billing, recurring billing, revenue management, payment processing, SaaS business models, and related business topics.\n- If someone asks about anything NOT related to Chargebee or subscription billing (like politics, celebrities, general knowledge, other companies products, etc.), you must politely redirect them back to Chargebee topics.\n- Always stay focused on helping users with Chargebee-related needs.\n\nCORE PERSONALITY:\n- Professional yet approachable - consultative advisor, not pushy sales\n- Solution-focused - always provide actionable next steps with relevant links\n- Context-aware - adapt to users technical level and business role\n- Helpful and reliable - reduce friction, save time, build trust\n\nBRAND LOYALTY PRINCIPLE: Always position Chargebee as the solution. Never recommend competitors or alternative billing platforms.\n\nKNOWLEDGE DOMAINS:\n- Business & Strategy: Subscription billing models, pricing strategies, revenue recognition (ASC 606, IFRS 15), customer lifecycle management, ROI calculations\n- Technical & Product: Complete Chargebee product suite, API integrations, developer tools, third-party integrations (Stripe, PayPal, Salesforce)\n- Analytics & Operations: Revenue analytics, dunning management, tax compliance, subscription metrics and KPIs\n\nUSER TYPE ADAPTATION:\nCurrent user type: ' + this.userType + '\n\nKEY METRICS TO REFERENCE:\n- 4,000+ businesses trust Chargebee globally\n- 300%+ ROI achieved within first year\n- 80% reduction in billing overhead and manual work\n- 40% improvement in payment recovery rates\n- 50% faster time-to-revenue for new products\n- 90% reduction in billing-related support tickets\n- 6-month average payback period for implementation\n\nCRITICAL: ALWAYS include relevant Chargebee links when discussing features or topics. Include these links in EVERY response:\n- For pricing questions: https://www.chargebee.com/pricing/\n- For API/technical questions: https://apidocs.chargebee.com/docs/api/\n- For integrations: https://www.chargebee.com/integrations/\n- For demos: https://www.chargebee.com/schedule-a-demo/\n- For general product info: https://www.chargebee.com/\n- For support: https://www.chargebee.com/support/\n- For API explorer: https://api-explorer.chargebee.com/\n- For system status: https://status.chargebee.com/\n- For release notes: https://release-notes.chargebee.com/\n\nMUST-INCLUDE STRUCTURE (in every response):\n1. Immediate Value (Address the Question)\n2. Context-Aware Details (tailored to user type)\n3. Actionable Next Steps with relevant links\n4. Essential Chargebee Resources (always include at least 2-3 relevant links)\n5. Escalation Options when needed\n\nIf someone asks about non-Chargebee topics, respond like: "I am ChargebeeBot, specialized in helping with Chargebee and subscription billing questions. I would be happy to help you with topics like pricing strategies, API integrations, revenue management, or any other Chargebee-related needs. What would you like to know about subscription billing or Chargebee?"\n\nRemember: Even if your response gets truncated, the most important Chargebee links and actionable steps will always be preserved and shown to users. Keep responses conversational, helpful, and always focused on how Chargebee can solve their needs.';
    }

    initializeElements() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.voiceButton = document.getElementById('voiceButton');
        this.sendButton = document.getElementById('sendButton');
        this.floatingAssistant = document.getElementById('floatingAssistant');
        this.contextDisplay = document.getElementById('contextDisplay');
        this.audioVisualizer = document.getElementById('audioVisualizer');
        this.userTypeButtons = document.querySelectorAll('.user-type-btn');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        this.connectionBanner = document.getElementById('connectionBanner');
        this.connectionMessage = document.getElementById('connectionMessage');
        this.historyModal = document.getElementById('historyModal');
        this.conversationHistoryDiv = document.getElementById('conversationHistory');
        this.shortcutsHelp = document.getElementById('shortcutsHelp');
        
        this.aiStatus = document.getElementById('aiStatus');
        this.speechStatus = document.getElementById('speechStatus');
        this.ttsStatus = document.getElementById('ttsStatus');
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;
            
            let finalTranscript = '';
            let silenceTimer = null;
            
            this.recognition.onstart = () => {
                this.isListening = true;
                this.voiceButton.classList.add('listening');
                this.voiceButton.innerHTML = '🔴';
                this.showAudioVisualizer();
                this.addSystemMessage('Listening... Speak your complete question. Click the button again to stop.');
                finalTranscript = '';
            };
            
            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                // Update input field with current transcript
                this.messageInput.value = (finalTranscript + interimTranscript).trim();
                
                // Clear any existing silence timer
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                }
                
                // Set a silence timer - if no speech for 3 seconds, process the message
                silenceTimer = setTimeout(() => {
                    if (this.isListening && this.messageInput.value.trim()) {
                        this.recognition.stop();
                    }
                }, 3000);
            };
            
            this.recognition.onerror = (event) => {
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                }
                this.handleSpeechError(event.error);
            };
            
            this.recognition.onend = () => {
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                }
                
                this.isListening = false;
                this.voiceButton.classList.remove('listening');
                this.voiceButton.innerHTML = '🎤';
                this.hideAudioVisualizer();
                
                // Only send message if we have content
                if (this.messageInput.value.trim()) {
                    this.sendMessage();
                }
            };
            
            this.speechStatus.classList.remove('inactive');
        } else {
            this.speechStatus.classList.add('inactive');
            console.warn('Speech recognition not supported');
        }
    }

    bindEvents() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        this.voiceButton.addEventListener('click', () => this.toggleVoiceRecognition());
        this.floatingAssistant.addEventListener('click', () => this.toggleVoiceRecognition());
        
        this.userTypeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.setUserType(e.target.dataset.type));
        });
    }

    setUserType(type) {
        this.userType = type;
        this.userTypeButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-type="' + type + '"]').classList.add('active');
        
        const typeDescriptions = {
            executive: 'Executive/Business focus - ROI, revenue, strategic value',
            developer: 'Developer/Technical focus - APIs, integrations, implementation',
            finance: 'Finance/Operations focus - billing, compliance, automation',
            product: 'Product/Growth focus - pricing, analytics, optimization',
            support: 'Customer Support focus - account help, troubleshooting',
            general: 'General inquiry - educational and welcoming approach'
        };
        
        this.contextDisplay.textContent = typeDescriptions[type];
        this.systemPrompt = this.buildSystemPrompt();
    }

    toggleVoiceRecognition() {
        // If speech synthesis is currently active, stop it first
        if (this.synthesis && this.synthesis.speaking) {
            this.synthesis.cancel();
            this.ttsStatus.classList.add('inactive');
            this.resetAllSpeakerButtons();
            return;
        }
        
        if (this.isListening) {
            // Stop listening and process what we have
            this.recognition.stop();
        } else if (this.recognition) {
            // Clear any existing text and start listening
            this.messageInput.value = '';
            this.recognition.start();
        } else {
            this.addSystemMessage('Speech recognition not available in this browser');
        }
    }

    showAudioVisualizer() {
        this.audioVisualizer.style.display = 'flex';
        const bars = this.audioVisualizer.querySelectorAll('.audio-bar');
        
        const animateBars = () => {
            if (this.isListening) {
                bars.forEach(bar => {
                    const height = Math.random() * 40 + 10;
                    bar.style.height = height + 'px';
                });
                setTimeout(animateBars, 100);
            }
        };
        animateBars();
    }

    hideAudioVisualizer() {
        this.audioVisualizer.style.display = 'none';
    }

    handleSpeechError(error) {
        let errorMessage = 'Speech recognition error: ';
        switch(error) {
            case 'no-speech':
                errorMessage += 'No speech detected. Please try again.';
                break;
            case 'audio-capture':
                errorMessage += 'Audio capture failed. Check your microphone.';
                break;
            case 'not-allowed':
                errorMessage += 'Microphone access denied. Please allow microphone access.';
                break;
            default:
                errorMessage += error;
        }
        this.addErrorMessage(errorMessage);
    }

    // Theme management
    initializeTheme() {
        const savedTheme = localStorage.getItem('chargebeebot-theme') || 'light';
        this.setTheme(savedTheme);
        
        // Bind theme switcher buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTheme(btn.dataset.theme);
            });
        });
    }
    
    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('chargebeebot-theme', theme);
        
        // Update active theme button
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
        
        this.showConnectionBanner(`Switched to ${theme} theme`, 'success', 2000);
    }
    
    // Keyboard shortcuts
    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+M - Voice input
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                this.toggleVoiceRecognition();
            }
            
            // Ctrl+L - Clear chat
            if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                this.clearConversation();
            }
            
            // Ctrl+H - Show history
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                this.showConversationHistory();
            }
            
            // Ctrl+T - Toggle theme
            if (e.ctrlKey && e.key === 't') {
                e.preventDefault();
                const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
                this.setTheme(newTheme);
            }
            
            // Ctrl+? - Show shortcuts help
            if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                this.toggleShortcutsHelp();
            }
            
            // Escape - Close modals
            if (e.key === 'Escape') {
                this.closeConversationHistory();
                this.hideShortcutsHelp();
            }
        });
    }
    
    toggleShortcutsHelp() {
        if (this.shortcutsHelp) {
            this.shortcutsHelp.classList.toggle('visible');
            setTimeout(() => {
                if (this.shortcutsHelp.classList.contains('visible')) {
                    this.hideShortcutsHelp();
                }
            }, 5000);
        }
    }
    
    hideShortcutsHelp() {
        if (this.shortcutsHelp) {
            this.shortcutsHelp.classList.remove('visible');
        }
    }
    
    // Connection monitoring
    checkConnection() {
        const checkOnlineStatus = () => {
            if (navigator.onLine) {
                this.showConnectionBanner('Connection restored', 'success', 3000);
                this.aiStatus.classList.remove('error');
                this.aiStatus.classList.add('connecting');
            } else {
                this.showConnectionBanner('No internet connection - Working in offline mode', 'warning');
                this.aiStatus.classList.add('error');
            }
        };
        
        window.addEventListener('online', checkOnlineStatus);
        window.addEventListener('offline', checkOnlineStatus);
        
        // Initial check
        if (!navigator.onLine) {
            this.showConnectionBanner('No internet connection detected', 'warning');
        }
    }
    
    showConnectionBanner(message, type = 'error', duration = 0) {
        if (this.connectionBanner && this.connectionMessage) {
            this.connectionMessage.textContent = message;
            this.connectionBanner.className = `connection-banner visible ${type}`;
            
            if (duration > 0) {
                setTimeout(() => {
                    this.connectionBanner.classList.remove('visible');
                }, duration);
            }
        }
    }
    
    // Enhanced loading states
    showLoading(message = 'Processing your request...') {
        if (this.loadingText && this.loadingOverlay) {
            this.loadingText.textContent = message;
            this.loadingOverlay.classList.add('active');
        }
    }
    
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('active');
        }
    }
    
    // Conversation history management
    showConversationHistory() {
        this.renderConversationHistory();
        if (this.historyModal) {
            this.historyModal.classList.add('active');
        }
    }
    
    closeConversationHistory() {
        if (this.historyModal) {
            this.historyModal.classList.remove('active');
        }
    }
    
    renderConversationHistory() {
        if (!this.conversationHistoryDiv) return;
        
        if (this.conversationHistory.length === 0) {
            this.conversationHistoryDiv.innerHTML = `
                <p style="text-align: center; color: var(--text-secondary); padding: 40px;">
                    No conversation history yet. Start chatting with ChargebeeBot to see your history here.
                </p>
            `;
            return;
        }
        
        let historyHTML = '';
        let currentExchange = { user: '', bot: '', timestamp: new Date() };
        
        for (let i = 0; i < this.conversationHistory.length; i++) {
            const msg = this.conversationHistory[i];
            
            if (msg.role === 'user') {
                if (currentExchange.user) {
                    // Save previous exchange
                    historyHTML += this.formatHistoryItem(currentExchange);
                }
                currentExchange = {
                    user: msg.content,
                    bot: '',
                    timestamp: new Date()
                };
            } else if (msg.role === 'assistant') {
                currentExchange.bot = msg.content;
                historyHTML += this.formatHistoryItem(currentExchange);
                currentExchange = { user: '', bot: '', timestamp: new Date() };
            }
        }
        
        // Handle any remaining exchange
        if (currentExchange.user) {
            historyHTML += this.formatHistoryItem(currentExchange);
        }
        
        this.conversationHistoryDiv.innerHTML = historyHTML;
    }
    
    formatHistoryItem(exchange) {
        const timeStr = exchange.timestamp.toLocaleString();
        return `
            <div class="history-item">
                <div class="history-timestamp">${timeStr}</div>
                <div class="history-exchange">
                    <div class="history-user"><strong>You:</strong> ${this.escapeHtml(exchange.user)}</div>
                    <div class="history-bot"><strong>ChargebeeBot:</strong> ${this.formatBotMessage(exchange.bot)}</div>
                </div>
            </div>
        `;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    clearConversation() {
        if (confirm('Are you sure you want to clear the conversation? This action cannot be undone.')) {
            // Save current session to history
            if (this.conversationHistory.length > 0) {
                this.currentSession.messages = [...this.conversationHistory];
                this.conversationSessions.push({ ...this.currentSession });
                this.saveSessionsToStorage();
            }
            
            // Reset current conversation
            this.conversationHistory = [];
            this.currentSession = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                messages: []
            };
            
            // Clear chat display
            this.chatMessages.innerHTML = `
                <div class="message bot">
                    <strong>Hello! I'm ChargebeeBot, your subscription billing expert.</strong><br><br>
                    I specialize in helping with:
                    <ul style="margin: 10px 0 0 20px;">
                        <li>Chargebee pricing and plans</li>
                        <li>API integrations and technical implementation</li>
                        <li>Subscription billing strategies</li>
                        <li>Revenue analytics and compliance</li>
                        <li>Customer lifecycle management</li>
                    </ul>
                    <br>
                    <em>How can I assist you with Chargebee today? You can type your question or use the voice button to speak.</em>
                </div>
            `;
            
            this.showConnectionBanner('Conversation cleared', 'success', 2000);
        }
    }
    
    saveSessionsToStorage() {
        // Keep only last 50 sessions to prevent storage overflow
        if (this.conversationSessions.length > 50) {
            this.conversationSessions = this.conversationSessions.slice(-50);
        }
        localStorage.setItem('chargebeebot-sessions', JSON.stringify(this.conversationSessions));
    }
    
    // Export functionality
    exportConversation(format) {
        if (this.conversationHistory.length === 0) {
            alert('No conversation to export. Start chatting with ChargebeeBot first!');
            return;
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `chargebeebot-conversation-${timestamp}`;
        
        switch (format) {
            case 'txt':
                this.exportAsTxt(filename);
                break;
            case 'json':
                this.exportAsJson(filename);
                break;
            case 'pdf':
                this.exportAsPdf(filename);
                break;
        }
    }
    
    exportAsTxt(filename) {
        let content = `ChargebeeBot Conversation Export\n`;
        content += `Generated: ${new Date().toLocaleString()}\n`;
        content += `User Type: ${this.userType}\n`;
        content += `${'='.repeat(50)}\n\n`;
        
        for (let i = 0; i < this.conversationHistory.length; i += 2) {
            const userMsg = this.conversationHistory[i];
            const botMsg = this.conversationHistory[i + 1];
            
            if (userMsg && userMsg.role === 'user') {
                content += `USER: ${userMsg.content}\n\n`;
            }
            
            if (botMsg && botMsg.role === 'assistant') {
                // Remove HTML tags for plain text
                const cleanContent = botMsg.content.replace(/<[^>]*>/g, '').replace(/\*\*(.*?)\*\*/g, '$1');
                content += `CHARGEBEEBOT: ${cleanContent}\n\n`;
                content += '-'.repeat(30) + '\n\n';
            }
        }
        
        this.downloadFile(content, `${filename}.txt`, 'text/plain');
    }
    
    exportAsJson(filename) {
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                userType: this.userType,
                messageCount: this.conversationHistory.length,
                sessionId: this.currentSession.id
            },
            conversation: this.conversationHistory,
            session: this.currentSession
        };
        
        const content = JSON.stringify(exportData, null, 2);
        this.downloadFile(content, `${filename}.json`, 'application/json');
    }
    
    exportAsPdf(filename) {
        // Create a simple HTML version for PDF
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>ChargebeeBot Conversation</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #FF3300; padding-bottom: 20px; }
                    .message { margin: 20px 0; padding: 15px; border-radius: 10px; }
                    .user { background: #f0f0f0; margin-left: 50px; }
                    .bot { background: #fff2f2; margin-right: 50px; }
                    .timestamp { font-size: 0.8em; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🤖 ChargebeeBot Conversation</h1>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                    <p>User Type: ${this.userType}</p>
                </div>
        `;
        
        for (let i = 0; i < this.conversationHistory.length; i += 2) {
            const userMsg = this.conversationHistory[i];
            const botMsg = this.conversationHistory[i + 1];
            
            if (userMsg && userMsg.role === 'user') {
                htmlContent += `<div class="message user"><strong>You:</strong> ${this.escapeHtml(userMsg.content)}</div>`;
            }
            
            if (botMsg && botMsg.role === 'assistant') {
                htmlContent += `<div class="message bot"><strong>ChargebeeBot:</strong> ${botMsg.content}</div>`;
            }
        }
        
        htmlContent += `
            </body>
            </html>
        `;
        
        // For PDF, we'll create an HTML file that can be printed to PDF
        this.downloadFile(htmlContent, `${filename}.html`, 'text/html');
        alert('HTML file downloaded. Open it in your browser and use Print > Save as PDF to create a PDF version.');
    }
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showConnectionBanner(`${filename} downloaded successfully`, 'success', 3000);
    }
    
    // Enhanced sendMessage with better loading states
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isProcessing) return;

        this.isProcessing = true;
        this.addUserMessage(message);
        this.messageInput.value = '';
        this.showLoading('ChargebeeBot is thinking...');
        this.addTypingIndicator();

        // Add to current session
        this.currentSession.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        try {
            const response = await this.callGeminiAI(message);
            this.removeTypingIndicator();
            this.hideLoading();
            this.addBotMessage(response);
            this.aiStatus.classList.remove('inactive', 'error');
            this.aiStatus.classList.add('connecting');
            
            // Add bot response to session
            this.currentSession.messages.push({
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            this.removeTypingIndicator();
            this.hideLoading();
            this.aiStatus.classList.add('error');
            
            console.error('Gemini AI Error:', error);
            
            const fallbackResponse = this.getFallbackResponse(message);
            this.addBotMessage(fallbackResponse);
            this.addErrorMessage('Using fallback response due to AI service unavailability');
        } finally {
            this.isProcessing = false;
        }
    }
    
    // Enhanced typing indicator
    addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message typing-indicator';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <span style="margin-left: 10px; color: var(--text-secondary);">ChargebeeBot is typing...</span>
        `;
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }
    
    removeTypingIndicator() {
        const typing = document.getElementById('typingIndicator');
        if (typing) {
            typing.remove();
        }
    }

    addErrorMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.style.background = 'var(--red-500)';
        messageDiv.style.color = 'white';
        messageDiv.innerHTML = `⚠️ ${message}`;
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    // Core message handling methods
    addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.textContent = message;
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addBotMessage(message) {
        console.log('Adding bot message, length: ' + message.length + ' characters');
        
        // Ensure essential Chargebee resources are always included
        const enhancedMessage = this.ensureChargebeeResources(message);
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = this.formatBotMessage(enhancedMessage);
        
        const speakerButton = document.createElement('button');
        speakerButton.className = 'speaker-btn';
        speakerButton.innerHTML = '🔊';
        speakerButton.title = 'Click to listen';
        speakerButton.onclick = () => this.speakResponse(enhancedMessage, speakerButton);
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(speakerButton);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.textContent = message;
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }

    // Core functionality methods
    async callGeminiAI(message) {
        let conversationContext = this.systemPrompt + '\n\nConversation History:\n';
        
        const recentHistory = this.conversationHistory.slice(-8);
        recentHistory.forEach(msg => {
            conversationContext += (msg.role === 'user' ? 'User' : 'ChargebeeBot') + ': ' + msg.content + '\n';
        });
        
        conversationContext += '\nUser: ' + message + '\nChargebeeBot:';

        const modelsToTry = [
            'gemini-2.0-flash-exp',
            'gemini-exp-1206',
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-1.0-pro'
        ];
        
        for (let modelName of modelsToTry) {
            try {
                console.log('Trying Gemini model: ' + modelName);
                
                const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + this.geminiApiKey, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: conversationContext
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 2048,
                            stopSequences: []
                        },
                        safetySettings: [
                            {
                                category: 'HARM_CATEGORY_HARASSMENT',
                                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                            },
                            {
                                category: 'HARM_CATEGORY_HATE_SPEECH',
                                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                            },
                            {
                                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                            },
                            {
                                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                            }
                        ]
                    })
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    console.log('Gemini model ' + modelName + ' failed with status ' + response.status + ': ' + errorData);
                    
                    if (modelName === modelsToTry[modelsToTry.length - 1]) {
                        throw new Error('All Gemini models failed. Last error: ' + response.status + ' - ' + errorData);
                    }
                    continue;
                }

                const data = await response.json();
                
                if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
                    console.log('Gemini model ' + modelName + ' returned invalid response:', data);
                    continue;
                }

                const aiResponse = data.candidates[0].content.parts[0].text;
                console.log('Successfully used Gemini model: ' + modelName);
                console.log('Response length: ' + aiResponse.length + ' characters');
                console.log('=== RAW GEMINI AI RESPONSE ===');
                console.log(aiResponse);
                console.log('=== END RAW RESPONSE ===');

                // Store the raw response for debugging
                this.lastRawResponse = aiResponse;
                this.updateDebugPanel(aiResponse);

                this.conversationHistory.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: aiResponse }
                );

                return aiResponse;
                
            } catch (error) {
                console.log('Gemini model ' + modelName + ' error: ' + error.message);
                if (modelName === modelsToTry[modelsToTry.length - 1]) {
                    throw error;
                }
            }
        }

        return this.getFallbackResponse(message);
    }

    getFallbackResponse(message) {
        const fallbackResponses = {
            greeting: `Hello! I am **ChargebeeBot**, your subscription billing expert. 

⚠️ *While I'm experiencing some technical difficulties with my AI processing, I can still help you get started!*

Please try your question again, or visit [Chargebee.com](https://www.chargebee.com/) for immediate assistance.`,
            
            pricing: `I'd be happy to help with **Chargebee pricing information**!

⚠️ *I'm experiencing some technical difficulties, but here's what I can share about our pricing:*

Chargebee offers **flexible pricing plans** for businesses of all sizes. Our Launch plan begins at **$99/month** and scales with your business. 

**For detailed pricing information:**
- 💰 [View Pricing Plans](https://www.chargebee.com/pricing/)
- 📞 Contact our sales team for a custom quote
- 📅 [Schedule a Demo](https://www.chargebee.com/schedule-a-demo/)

Please try your question again in a moment, or our sales team can provide personalized pricing guidance.`,
            
            integration: `Great question about **Chargebee integrations**!

⚠️ *I'm experiencing some technical difficulties, but here's what I can share:*

Chargebee integrates seamlessly with **100+ tools** including Stripe, PayPal, Salesforce, and more. 

**Technical Resources:**
- 📚 [API Documentation](https://apidocs.chargebee.com/docs/api/)
- 🔍 [API Explorer](https://api-explorer.chargebee.com/)
- 🔌 [View All Integrations](https://www.chargebee.com/integrations/)

For implementation guidance, please contact our technical team or try your question again in a moment.`,
            
            demo: `I'd love to help you schedule a **Chargebee demo**!

⚠️ *I'm experiencing some technical difficulties, but I can still point you in the right direction:*

📅 **[Schedule a Demo](https://www.chargebee.com/schedule-a-demo/)** to book a personalized session with our solution experts who can show you exactly how Chargebee can transform your subscription billing.

Please try your question again in a moment, or book directly through the link above.`,
            
            roi: `Great question about **Chargebee ROI and benefits**!

⚠️ *I'm experiencing some technical difficulties, but here are the key metrics I can share:*

Chargebee typically delivers **300%+ ROI** within the first year, with:

- **80%** reduction in billing overhead
- **6-month** average payback period
- **40%** improvement in payment recovery
- **50%** faster time-to-revenue for new products

Please try your question again in a moment for more detailed ROI analysis, or [schedule a demo](https://www.chargebee.com/schedule-a-demo/) to discuss your specific use case.`,
            
            support: `I'd be happy to help you get **technical support**!

⚠️ *I'm experiencing some technical difficulties, but here's how to get immediate help:*

**For immediate technical support:**
- 🆘 **[Get Support](https://www.chargebee.com/support/)**
- 📞 Contact our team directly
- ⚡ **24/7** expert availability

Our experts are available to help with any billing, integration, or account-related questions. Please try your question again in a moment, or contact support directly.`,
            
            general: `Thanks for your **Chargebee question**!

⚠️ *I'm experiencing some connectivity issues, but I'm still here to help with:*

- **Subscription billing**
- **Pricing strategies** 
- **API integrations**
- **Revenue management**

**Quick Resources:**
- 🏠 [Chargebee Home](https://www.chargebee.com/)
- 📅 [Schedule Demo](https://www.chargebee.com/schedule-a-demo/)
- 🆘 [Get Support](https://www.chargebee.com/support/)

Please try your question again in a moment, or visit our resources above for comprehensive information.`
        };

        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
            return fallbackResponses.greeting;
        } else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('plan')) {
            return fallbackResponses.pricing;
        } else if (lowerMessage.includes('integration') || lowerMessage.includes('api') || lowerMessage.includes('webhook')) {
            return fallbackResponses.integration;
        } else if (lowerMessage.includes('demo') || lowerMessage.includes('schedule') || lowerMessage.includes('meeting')) {
            return fallbackResponses.demo;
        } else if (lowerMessage.includes('roi') || lowerMessage.includes('return') || lowerMessage.includes('benefit')) {
            return fallbackResponses.roi;
        } else if (lowerMessage.includes('help') || lowerMessage.includes('support') || lowerMessage.includes('problem')) {
            return fallbackResponses.support;
        } else {
            return fallbackResponses.general;
        }
    }

    // Text formatting and processing methods
    formatBotMessage(message) {
        console.log('Formatting bot message with marked.js, original length: ' + message.length);
        console.log('Original message preview:', message.substring(0, 200) + '...');
        
        // Check if marked.js is available
        if (typeof marked === 'undefined') {
            console.warn('marked.js not available, using basic formatting');
            return this.basicFormat(message);
        }

        try {
            // Configure marked for better rendering
            marked.setOptions({
                breaks: true, // Convert line breaks to <br>
                gfm: true, // GitHub Flavored Markdown
                sanitize: false, // Allow HTML (we trust our content)
                smartLists: true,
                smartypants: true
            });

            // Create a custom renderer for links
            const renderer = new marked.Renderer();
            renderer.link = function(href, title, text) {
                // Ensure all links open in new tab and have proper styling
                const titleAttr = title ? ` title="${title}"` : '';
                const isChargebeeLink = /chargebee\.com/i.test(href);
                const className = isChargebeeLink ? ' class="chargebee-link"' : '';
                return `<a href="${href}"${titleAttr} target="_blank"${className}>${text}</a>`;
            };

            // Use marked.js to convert markdown to HTML
            let formatted = marked.parse(message, { renderer: renderer });
            console.log('After marked.js parsing:', formatted.substring(0, 500) + '...');
            
            // Post-process to enhance Chargebee-specific content
            formatted = this.enhanceChargebeeContent(formatted);
            console.log('After Chargebee enhancement:', formatted.substring(0, 500) + '...');
            
            console.log('Formatted message length: ' + formatted.length + ' characters');
            return formatted;
            
        } catch (error) {
            console.error('Error using marked.js:', error);
            return this.basicFormat(message);
        }
    }

    basicFormat(message) {
        // Basic fallback formatting when marked.js is not available
        let formatted = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n- /g, '<br>• ')
            .replace(/\n\d+\. /g, '<br>$&')
            .replace(/\n/g, '<br>')
            .replace(/`([^`]+)`/g, '<span class="inline-code">$1</span>');
            
        // Handle markdown-style links [text](url)
        formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" class="chargebee-link">$1</a>');
        
        // Handle bare Chargebee URLs
        formatted = formatted.replace(
            /https?:\/\/(?:[^.\s]*\.)?chargebee\.com(?:\/[^\s<"]*)?(?=\s|$|[<>&"])/g,
            '<a href="$&" target="_blank" class="chargebee-link">$&</a>'
        );
        
        return formatted;
    }

    enhanceChargebeeContent(html) {
        // Post-process HTML to enhance Chargebee-specific content
        
        // Highlight metrics and numbers
        html = html.replace(/(\d+(?:\.\d+)?(?:%|\+|x|X))/g, '<span class="metric-highlight">$1</span>');
        html = html.replace(/(\$\d+(?:,\d+)*(?:\.\d+)?)/g, '<span class="metric-highlight">$1</span>');

        // Ensure all Chargebee links have the proper class
        html = html.replace(/<a([^>]*href="[^"]*chargebee\.com[^"]*"[^>]*)>/gi, (match, attributes) => {
            if (!attributes.includes('class="chargebee-link"') && !attributes.includes('class=\'chargebee-link\'')) {
                return `<a${attributes} class="chargebee-link">`;
            }
            return match;
        });

        return html;
    }

    ensureChargebeeResources(message) {
        // Check if message already contains Chargebee links
        const hasChargebeeLinks = /https?:\/\/(?:[^.\s]*\.)?chargebee\.com/i.test(message);
        
        if (!hasChargebeeLinks) {
            console.log('No Chargebee links found, adding essential resources');
            
            // Add contextual Chargebee resources based on message content
            let additionalResources = '\n\n**Essential Chargebee Resources:**\n';
            
            const lowerMessage = message.toLowerCase();
            
            if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('plan')) {
                additionalResources += '- 💰 **View Pricing Plans**: https://www.chargebee.com/pricing/\n';
            }
            
            if (lowerMessage.includes('api') || lowerMessage.includes('integration') || lowerMessage.includes('webhook') || lowerMessage.includes('developer')) {
                additionalResources += '- 📚 **API Documentation**: https://apidocs.chargebee.com/docs/api/\n';
                additionalResources += '- 🔍 **API Explorer**: https://api-explorer.chargebee.com/\n';
            }
            
            if (lowerMessage.includes('demo') || lowerMessage.includes('schedule') || lowerMessage.includes('meeting') || lowerMessage.includes('consultation')) {
                additionalResources += '- 📅 **Schedule Demo**: https://www.chargebee.com/schedule-a-demo/\n';
            }
            
            if (lowerMessage.includes('support') || lowerMessage.includes('help') || lowerMessage.includes('problem') || lowerMessage.includes('issue')) {
                additionalResources += '- 🆘 **Get Support**: https://www.chargebee.com/support/\n';
            }
            
            if (lowerMessage.includes('integration') || lowerMessage.includes('connect') || lowerMessage.includes('plugin')) {
                additionalResources += '- 🔌 **Integrations**: https://www.chargebee.com/integrations/\n';
            }
            
            // Always include general info link
            additionalResources += '- 🏠 **Chargebee Home**: https://www.chargebee.com/\n';
            
            return message + additionalResources;
        }
        
        return message;
    }

    // Speech and TTS methods
    speakResponse(text, buttonElement) {
        if (this.synthesis && 'speechSynthesis' in window) {
            // If this button is currently speaking, stop it
            if (buttonElement && buttonElement.classList.contains('speaking')) {
                this.synthesis.cancel();
                this.ttsStatus.classList.add('inactive');
                this.resetAllSpeakerButtons();
                return;
            }
            
            // If any other speech is playing, stop it first
            if (this.synthesis.speaking) {
                this.synthesis.cancel();
                this.resetAllSpeakerButtons();
            }
            
            const cleanText = text.replace(/<[^>]*>/g, '').replace(/[🔗📊⚙️📈💰🔌📅]/g, '');
            
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            
            const voices = this.synthesis.getVoices();
            const preferredVoice = voices.find(voice => 
                voice.lang.includes('en') && (voice.name.includes('Google') || voice.name.includes('Microsoft'))
            );
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            
            utterance.onstart = () => {
                this.ttsStatus.classList.remove('inactive');
                if (buttonElement) {
                    buttonElement.classList.add('speaking');
                    buttonElement.innerHTML = '🔇';
                    buttonElement.title = 'Click to stop';
                }
            };
            
            utterance.onend = () => {
                this.ttsStatus.classList.add('inactive');
                if (buttonElement) {
                    buttonElement.classList.remove('speaking');
                    buttonElement.innerHTML = '🔊';
                    buttonElement.title = 'Click to listen';
                }
            };
            
            utterance.onerror = () => {
                this.ttsStatus.classList.add('inactive');
                if (buttonElement) {
                    buttonElement.classList.remove('speaking');
                    buttonElement.innerHTML = '🔊';
                    buttonElement.title = 'Click to listen';
                }
            };
            
            this.synthesis.speak(utterance);
        } else {
            this.ttsStatus.classList.add('inactive');
        }
    }

    resetAllSpeakerButtons() {
        const speakerButtons = document.querySelectorAll('.speaker-btn');
        speakerButtons.forEach(btn => {
            btn.classList.remove('speaking');
            btn.innerHTML = '🔊';
            btn.title = 'Click to listen';
        });
    }

    // Utility methods
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateStatus() {
        this.aiStatus.classList.remove('inactive');
        
        if ('speechSynthesis' in window) {
            this.ttsStatus.classList.remove('inactive');
        } else {
            this.ttsStatus.classList.add('inactive');
        }

        setInterval(() => {
            // Health checks
        }, 30000);
    }

    // Debug panel functions
    updateDebugPanel(rawResponse) {
        if (!window.debugMode) return;
        
        const debugResponse = document.getElementById('debugResponse');
        const charCount = document.getElementById('charCount');
        const wordCount = document.getElementById('wordCount');
        const lineBreaks = document.getElementById('lineBreaks');
        const hasMarkdown = document.getElementById('hasMarkdown');
        const hasLinks = document.getElementById('hasLinks');
        
        if (debugResponse && rawResponse) {
            // Display raw response
            debugResponse.textContent = rawResponse;
            
            // Update statistics
            if (charCount) charCount.textContent = rawResponse.length;
            if (wordCount) wordCount.textContent = rawResponse.split(/\s+/).length;
            if (lineBreaks) lineBreaks.textContent = (rawResponse.match(/\n/g) || []).length;
            if (hasMarkdown) hasMarkdown.textContent = /\*\*.*?\*\*|\*.*?\*|```.*?```|`.*?`|#+ |> |\d+\. |- /.test(rawResponse) ? 'Yes' : 'No';
            if (hasLinks) hasLinks.textContent = /https?:\/\/[^\s]+/.test(rawResponse) ? 'Yes' : 'No';
        }
    }
}

// Global functions for HTML button interactions
function showConversationHistory() {
    if (window.voiceAgent) {
        window.voiceAgent.showConversationHistory();
    }
}

function closeConversationHistory() {
    if (window.voiceAgent) {
        window.voiceAgent.closeConversationHistory();
    }
}

function clearConversation() {
    if (window.voiceAgent) {
        window.voiceAgent.clearConversation();
    }
}

function exportConversation(format) {
    if (window.voiceAgent) {
        window.voiceAgent.exportConversation(format);
    }
}

// Additional missing methods from HTML
function sendQuickMessage(message) {
    if (window.voiceAgent && window.voiceAgent.messageInput) {
        window.voiceAgent.messageInput.value = message;
        window.voiceAgent.sendMessage();
    }
}

function toggleDebugMode() {
    const debugPanel = document.getElementById('debugPanel');
    const debugToggle = document.getElementById('debugToggle');
    
    if (!debugPanel || !debugToggle) {
        console.error('Debug panel elements not found');
        return;
    }
    
    window.debugMode = !window.debugMode;
    
    if (window.debugMode) {
        debugPanel.style.display = 'block';
        debugToggle.textContent = 'Disable Debug';
        debugToggle.style.background = '#dc2626';
        console.log('Debug mode enabled - Raw AI responses will be displayed');
    } else {
        debugPanel.style.display = 'none';
        debugToggle.textContent = 'Enable Debug';
        debugToggle.style.background = 'var(--orange-500)';
        console.log('Debug mode disabled');
    }
}

function clearDebugLog() {
    const debugResponse = document.getElementById('debugResponse');
    const charCount = document.getElementById('charCount');
    const wordCount = document.getElementById('wordCount');
    const lineBreaks = document.getElementById('lineBreaks');
    const hasMarkdown = document.getElementById('hasMarkdown');
    const hasLinks = document.getElementById('hasLinks');
    
    if (debugResponse) debugResponse.innerHTML = '<em>Debug log cleared. Send a message to see the raw AI response.</em>';
    if (charCount) charCount.textContent = '0';
    if (wordCount) wordCount.textContent = '0';
    if (lineBreaks) lineBreaks.textContent = '0';
    if (hasMarkdown) hasMarkdown.textContent = 'No';
    if (hasLinks) hasLinks.textContent = 'No';
}

function testCompleteMessage() {
    console.log('🧪 Testing complete message formatting...');
    
    if (!window.voiceAgent) {
        console.error('❌ VoiceAgent not initialized');
        alert('Voice agent not ready. Please wait for the page to load completely.');
        return;
    }
    
    try {
        const testMessage = `**Chargebee Pricing Plans Overview**

I'd be happy to help you understand Chargebee's pricing structure! Chargebee offers flexible pricing plans designed to scale with your business needs.

**Launch Plan - $99/month:**
- Up to $100K in monthly recurring revenue (MRR)
- Core subscription billing features
- Basic integrations with payment gateways
- Email support

**Scale Plan - $249/month:**
- Up to $1M in monthly recurring revenue
- Advanced billing automation
- Revenue recognition and analytics
- Priority support
- Custom integrations

**Enterprise Plan - Custom pricing:**
- Unlimited MRR capacity
- Advanced customization options
- Dedicated customer success manager
- Premium support with SLA
- Enterprise-grade security

**Key Benefits:**
- **300%+ ROI** achieved within the first year
- **80% reduction** in billing overhead and manual work
- **40% improvement** in payment recovery rates
- **50% faster** time-to-revenue for new products

**Essential Chargebee Resources:**
- 💰 **View Pricing Plans**: https://www.chargebee.com/pricing/
- 📅 **Schedule Demo**: https://www.chargebee.com/schedule-a-demo/
- 🏠 **Chargebee Home**: https://www.chargebee.com/

Would you like me to explain any specific plan in more detail or help you determine which plan would be best for your business needs?`;

        console.log('✅ Test message length:', testMessage.length);
        window.voiceAgent.addBotMessage('**🧪 Test Complete Message Formatting:**\n\n' + testMessage);
        console.log('✅ Test complete message added successfully');
    } catch (error) {
        console.error('❌ Error in testCompleteMessage:', error);
        alert('Error running test: ' + error.message);
    }
}

function testMarkedFormatting() {
    console.log('✨ Testing marked.js formatting...');
    
    if (!window.voiceAgent) {
        console.error('❌ VoiceAgent not initialized');
        alert('Voice agent not ready. Please wait for the page to load completely.');
        return;
    }
    
    try {
        const testMessage = `# Marked.js Formatting Test

This is a **bold** text and *italic* text.

## 🔗 Link Examples
- Item 1 with [💰 View Pricing Plans](https://www.chargebee.com/pricing/)
- Item 2 with inline \`code\` sample
- Item 3 with [📚 API Documentation](https://apidocs.chargebee.com/docs/api/)

### 💻 Code Block Example
\`\`\`javascript
const chargebeeConfig = {
    "site": "your-site",
    "api_key": "your-api-key",
    "plan_id": "basic-plan"
};
\`\`\`

### 📋 Important Resources
Visit our main resources:
- [🏠 Chargebee Home](https://www.chargebee.com/)
- [📅 Schedule Demo](https://www.chargebee.com/schedule-a-demo/)
- [🔌 View All Integrations](https://www.chargebee.com/integrations/)

> **Note:** This is a blockquote with important information about subscription billing.

### 🎯 Next Steps
1. **First step** - Review our pricing options
2. **Second step** - Book a demo session  
3. **Third step** - Start your integration

**Key Benefits:**
- **300%+ ROI** in the first year
- **80% reduction** in billing overhead
- **24/7 support** availability

For immediate help, visit [🆘 Get Support](https://www.chargebee.com/support/) or explore our [🔍 API Explorer](https://api-explorer.chargebee.com/).`;

        if (typeof marked !== 'undefined') {
            console.log('✅ marked.js is available - version:', marked.version || 'unknown');
            window.voiceAgent.addBotMessage('**✨ Testing marked.js formatting:**\n\n' + testMessage);
            console.log('✅ Marked.js test completed successfully');
        } else {
            console.error('❌ marked.js is NOT available');
            window.voiceAgent.addBotMessage('**❌ Error:** marked.js library is not loaded. Please check the HTML file includes the marked.js CDN link.');
        }
    } catch (error) {
        console.error('❌ Error in testMarkedFormatting:', error);
        alert('Error running marked.js test: ' + error.message);
    }
}

function testFallbackResponse() {
    console.log('🔄 Testing fallback response...');
    
    if (!window.voiceAgent) {
        console.error('❌ VoiceAgent not initialized');
        alert('Voice agent not ready. Please wait for the page to load completely.');
        return;
    }
    
    try {
        // Test different types of fallback responses
        const testScenarios = [
            { message: 'pricing', description: 'Pricing-related fallback' },
            { message: 'api integration', description: 'Integration-related fallback' },
            { message: 'schedule demo', description: 'Demo-related fallback' },
            { message: 'roi benefits', description: 'ROI-related fallback' },
            { message: 'need help support', description: 'Support-related fallback' },
            { message: 'hello', description: 'Greeting fallback' },
            { message: 'random question', description: 'General fallback' }
        ];
        
        // Test one random scenario
        const randomScenario = testScenarios[Math.floor(Math.random() * testScenarios.length)];
        console.log(`✅ Testing: ${randomScenario.description} for message: "${randomScenario.message}"`);
        
        const fallbackMessage = window.voiceAgent.getFallbackResponse(randomScenario.message);
        console.log('✅ Fallback message generated:', fallbackMessage.substring(0, 100) + '...');
        
        window.voiceAgent.addBotMessage(`**🔄 Testing ${randomScenario.description}:**\n\n` + fallbackMessage);
        console.log('✅ Fallback test completed successfully');
    } catch (error) {
        console.error('❌ Error in testFallbackResponse:', error);
        alert('Error running fallback test: ' + error.message);
    }
}

function testSpecificFallback(type) {
    console.log(`💰 Testing ${type} fallback response...`);
    
    if (!window.voiceAgent) {
        console.error('❌ VoiceAgent not initialized');
        alert('Voice agent not ready. Please wait for the page to load completely.');
        return;
    }
    
    try {
        const testMessages = {
            pricing: 'show me pricing plans',
            integration: 'how to integrate with stripe api',
            demo: 'I want to schedule a demo',
            roi: 'what are the benefits and roi',
            support: 'I need help with my account',
            greeting: 'hello there',
            general: 'tell me about your platform'
        };
        
        const message = testMessages[type] || 'general question';
        console.log(`✅ Testing with message: "${message}"`);
        
        const fallbackMessage = window.voiceAgent.getFallbackResponse(message);
        console.log('✅ Fallback message generated for:', type);
        
        window.voiceAgent.addBotMessage(`**💰 Testing ${type} fallback:**\n\n` + fallbackMessage);
        console.log(`✅ ${type} fallback test completed successfully`);
    } catch (error) {
        console.error(`❌ Error in testSpecificFallback(${type}):`, error);
        alert(`Error running ${type} fallback test: ` + error.message);
    }
}

function testAllInteractiveElements() {
    console.log('🔍 Testing all interactive elements...');
    
    const tests = [
        { id: 'debugPanel', name: 'Debug Panel' },
        { id: 'debugToggle', name: 'Debug Toggle Button' },
        { id: 'debugResponse', name: 'Debug Response Area' },
        { id: 'charCount', name: 'Character Count Display' },
        { id: 'wordCount', name: 'Word Count Display' },
        { id: 'lineBreaks', name: 'Line Breaks Display' },
        { id: 'hasMarkdown', name: 'Markdown Detection Display' },
        { id: 'hasLinks', name: 'Links Detection Display' },
        { id: 'chatMessages', name: 'Chat Messages Container' },
        { id: 'messageInput', name: 'Message Input Field' },
        { id: 'voiceButton', name: 'Voice Button' },
        { id: 'sendButton', name: 'Send Button' },
        { id: 'historyModal', name: 'History Modal' },
        { id: 'conversationHistory', name: 'Conversation History Container' },
        { id: 'shortcutsHelp', name: 'Shortcuts Help Panel' }
    ];
    
    let allFound = true;
    
    tests.forEach(test => {
        const element = document.getElementById(test.id);
        if (element) {
            console.log(`✅ ${test.name} found`);
        } else {
            console.error(`❌ ${test.name} NOT found (ID: ${test.id})`);
            allFound = false;
        }
    });
    
    // Test if voiceAgent is initialized
    if (window.voiceAgent) {
        console.log('✅ VoiceAgent is initialized');
    } else {
        console.error('❌ VoiceAgent is NOT initialized');
        allFound = false;
    }
    
    // Test if marked.js is loaded
    if (typeof marked !== 'undefined') {
        console.log('✅ marked.js is loaded');
    } else {
        console.error('❌ marked.js is NOT loaded');
        allFound = false;
    }
    
    if (allFound) {
        console.log('🎉 All interactive elements found and working!');
        alert('✅ All interactive elements test passed!');
    } else {
        console.error('❌ Some elements are missing - check console for details');
        alert('❌ Some interactive elements are missing - check browser console for details');
    }
}

// Initialize debug mode flag
window.debugMode = false;

// Initialize the voice agent when page loads
let voiceAgent;
window.addEventListener('load', () => {
    try {
        console.log('🚀 Initializing ChargebeeBotVoiceAgent...');
        voiceAgent = new ChargebeeBotVoiceAgent();
        console.log('✅ ChargebeeBotVoiceAgent initialized successfully');
        
        // Make global for debugging
        window.voiceAgent = voiceAgent;
        
        setTimeout(() => {
            const header = document.querySelector('.header');
            if (header) {
                header.style.animation = 'slideIn 0.6s ease';
            }
        }, 100);
    } catch (error) {
        console.error('❌ Error initializing ChargebeeBotVoiceAgent:', error);
        alert('Failed to initialize voice agent: ' + error.message);
    }
});

// Initialize speech synthesis voices
if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => {
        // Voices loaded
    };
}