"use strict";

/**
 * LLM Providers for translation service
 * Supports Ollama (local) and OpenRouter (cloud)
 */
const llmProviders = (function () {

  /**
   * Simple logger for LLM operations
   */
  const Logger = {
    _debugMode: false,

    setDebugMode(enabled) {
      this._debugMode = enabled;
    },

    _format(level, provider, message, data) {
      const timestamp = new Date().toISOString().substr(11, 12);
      const prefix = `[${timestamp}] [LLM:${provider}]`;
      if (data && Object.keys(data).length > 0) {
        return [prefix, message, data];
      }
      return [prefix, message];
    },

    debug(provider, message, data = {}) {
      if (this._debugMode) {
        console.log(...this._format("DEBUG", provider, message, data));
      }
    },

    info(provider, message, data = {}) {
      console.info(...this._format("INFO", provider, message, data));
    },

    warn(provider, message, data = {}) {
      console.warn(...this._format("WARN", provider, message, data));
    },

    error(provider, message, data = {}) {
      console.error(...this._format("ERROR", provider, message, data));
    }
  };

  /**
   * Base class for LLM providers
   */
  class LLMProvider {
    constructor(config) {
      this.config = config;
      this.name = "base";
    }

    /**
     * Build translation prompt
     * @param {string} text - Text to translate
     * @param {string} targetLang - Target language
     * @returns {string} Prompt
     */
    buildPrompt(text, targetLang) {
      if (this.config.llmPromptTemplate) {
        return this.config.llmPromptTemplate
          .replace("{text}", text)
          .replace("{targetLang}", targetLang);
      }

      // Default prompt - optimized for translation
      return `Translate the following text to ${targetLang}. Rules:
1. Only return the translated text, nothing else
2. Preserve the original formatting (line breaks, spacing)
3. Do not add explanations or notes

Text to translate:
${text}`;
    }

    /**
     * Build prompt for batch translation (multiple segments)
     * @param {string[]} texts - Array of texts to translate
     * @param {string} targetLang - Target language
     * @returns {string} Prompt
     */
    buildBatchPrompt(texts, targetLang) {
      const separator = "\n[---SEP---]\n";
      const combined = texts.join(separator);

      return `Translate each text segment to ${targetLang}. Rules:
1. Each segment is separated by [---SEP---]
2. Return translations in the same order, separated by [---SEP---]
3. Only return translated text, no explanations
4. Preserve formatting within each segment

Segments to translate:
${combined}`;
    }

    /**
     * Parse batch translation response
     * @param {string} response - LLM response
     * @param {number} expectedCount - Expected number of segments
     * @returns {string[]} Array of translations
     */
    parseBatchResponse(response, expectedCount) {
      const separator = /\[---SEP---\]/;
      const parts = response.split(separator).map(s => s.trim());

      // If count doesn't match, log warning and try to handle gracefully
      if (parts.length !== expectedCount) {
        Logger.warn(this.name, `Batch response count mismatch`, {
          expected: expectedCount,
          got: parts.length
        });

        // Pad with empty strings or truncate
        while (parts.length < expectedCount) {
          parts.push("");
        }
        if (parts.length > expectedCount) {
          parts.length = expectedCount;
        }
      }

      return parts;
    }

    /**
     * Translate single text
     * @param {string} text - Text to translate
     * @param {string} targetLang - Target language code
     * @param {string} sourceLang - Source language code (optional)
     * @returns {Promise<string>} Translated text
     */
    async translate(text, targetLang, sourceLang = "auto") {
      throw new Error("translate() must be implemented by subclass");
    }

    /**
     * Translate multiple texts in batch
     * @param {string[]} texts - Array of texts
     * @param {string} targetLang - Target language code
     * @param {string} sourceLang - Source language code (optional)
     * @returns {Promise<string[]>} Array of translated texts
     */
    async translateBatch(texts, targetLang, sourceLang = "auto") {
      // Default implementation: use batch prompt
      if (texts.length === 0) return [];
      if (texts.length === 1) {
        const result = await this.translate(texts[0], targetLang, sourceLang);
        return [result];
      }

      const prompt = this.buildBatchPrompt(texts, targetLang);
      const response = await this._callAPI(prompt);
      return this.parseBatchResponse(response, texts.length);
    }

    /**
     * Test connection to the LLM provider
     * @returns {Promise<{success: boolean, message: string, model?: string}>}
     */
    async testConnection() {
      throw new Error("testConnection() must be implemented by subclass");
    }

    /**
     * Internal method to call the API
     * @param {string} prompt - The prompt to send
     * @returns {Promise<string>} The response text
     */
    async _callAPI(prompt) {
      throw new Error("_callAPI() must be implemented by subclass");
    }
  }

  /**
   * Ollama provider (local LLM)
   */
  class OllamaProvider extends LLMProvider {
    constructor(config) {
      super(config);
      this.name = "ollama";
    }

    get baseUrl() {
      return this.config.ollamaApiUrl || "http://localhost:11434";
    }

    get model() {
      return this.config.ollamaModel || "qwen2.5:7b";
    }

    async _callAPI(prompt) {
      const url = `${this.baseUrl}/v1/chat/completions`;

      Logger.debug(this.name, "Calling API", {
        url,
        model: this.model,
        promptLength: prompt.length
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          temperature: this.config.llmTemperature || 0.3,
          max_tokens: this.config.llmMaxTokens || 2000,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(this.name, "API request failed", {
          status: response.status,
          error: errorText
        });
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const result = data.choices?.[0]?.message?.content || "";

      Logger.debug(this.name, "API response received", {
        responseLength: result.length
      });

      return result.trim();
    }

    async translate(text, targetLang, sourceLang = "auto") {
      const prompt = this.buildPrompt(text, targetLang);
      return await this._callAPI(prompt);
    }

    async testConnection() {
      try {
        // First check if Ollama is running by listing models
        const tagsUrl = `${this.baseUrl}/api/tags`;
        Logger.debug(this.name, "Testing connection", { url: tagsUrl });

        const response = await fetch(tagsUrl);

        if (!response.ok) {
          return {
            success: false,
            message: `Cannot connect to Ollama at ${this.baseUrl}`
          };
        }

        const data = await response.json();
        const models = data.models || [];
        const modelNames = models.map(m => m.name);

        // Check if the configured model exists
        const modelExists = modelNames.some(name =>
          name === this.model || name.startsWith(this.model + ":")
        );

        if (!modelExists) {
          return {
            success: false,
            message: `Model "${this.model}" not found. Available: ${modelNames.join(", ")}`
          };
        }

        // Try a simple translation to verify it works
        const testResult = await this.translate("Hello", "Chinese");

        return {
          success: true,
          message: `Connected successfully`,
          model: this.model,
          testTranslation: testResult
        };
      } catch (error) {
        Logger.error(this.name, "Connection test failed", { error: error.message });
        return {
          success: false,
          message: `Connection failed: ${error.message}`
        };
      }
    }
  }

  /**
   * OpenRouter provider (cloud LLM)
   */
  class OpenRouterProvider extends LLMProvider {
    constructor(config) {
      super(config);
      this.name = "openrouter";
    }

    get baseUrl() {
      return this.config.openrouterApiUrl || "https://openrouter.ai/api/v1";
    }

    get apiKey() {
      return this.config.openrouterApiKey || "";
    }

    get model() {
      return this.config.openrouterModel || "anthropic/claude-3-haiku";
    }

    async _callAPI(prompt) {
      if (!this.apiKey) {
        throw new Error("OpenRouter API key is not configured");
      }

      const url = `${this.baseUrl}/chat/completions`;

      Logger.debug(this.name, "Calling API", {
        url,
        model: this.model,
        promptLength: prompt.length
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://github.com/anthropics/context-translate",
          "X-Title": "Context Translate"
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          temperature: this.config.llmTemperature || 0.3,
          max_tokens: this.config.llmMaxTokens || 2000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;
        Logger.error(this.name, "API request failed", {
          status: response.status,
          error: errorMessage
        });
        throw new Error(`OpenRouter API error: ${response.status} - ${errorMessage}`);
      }

      const data = await response.json();
      const result = data.choices?.[0]?.message?.content || "";

      Logger.debug(this.name, "API response received", {
        responseLength: result.length,
        usage: data.usage
      });

      return result.trim();
    }

    async translate(text, targetLang, sourceLang = "auto") {
      const prompt = this.buildPrompt(text, targetLang);
      return await this._callAPI(prompt);
    }

    async testConnection() {
      try {
        if (!this.apiKey) {
          return {
            success: false,
            message: "API key is not configured"
          };
        }

        Logger.debug(this.name, "Testing connection");

        // Try a simple translation
        const testResult = await this.translate("Hello", "Chinese");

        return {
          success: true,
          message: "Connected successfully",
          model: this.model,
          testTranslation: testResult
        };
      } catch (error) {
        Logger.error(this.name, "Connection test failed", { error: error.message });
        return {
          success: false,
          message: `Connection failed: ${error.message}`
        };
      }
    }
  }

  /**
   * Factory function to create LLM provider instance
   * @param {object} config - Configuration object from twpConfig
   * @returns {LLMProvider} Provider instance
   */
  function createProvider(config) {
    // Update logger debug mode
    Logger.setDebugMode(config.llmDebugMode === "yes");

    const provider = config.llmProvider || "ollama";

    switch (provider) {
      case "ollama":
        return new OllamaProvider(config);
      case "openrouter":
        return new OpenRouterProvider(config);
      default:
        Logger.warn("factory", `Unknown provider: ${provider}, falling back to Ollama`);
        return new OllamaProvider(config);
    }
  }

  // Export public API
  return {
    createProvider,
    Logger,
    // Export classes for potential extension
    LLMProvider,
    OllamaProvider,
    OpenRouterProvider
  };
})();
