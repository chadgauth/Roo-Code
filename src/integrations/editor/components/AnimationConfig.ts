import * as vscode from "vscode"

export interface AnimationSettings {
	enabled: boolean
	speed: "slow" | "normal" | "fast" | "instant"
	effects: {
		typewriter: boolean
		fadeIn: boolean
		highlights: boolean
		pulseActive: boolean
		smoothScrolling: boolean
		progressIndicators: boolean
	}
	colors: {
		addition: string
		deletion: string
		modification: string
		activeLine: string
		completed: string
		error: string
	}
	autoScroll: {
		enabled: boolean
		maxSpeed: number // lines per second
		adaptiveSpeed: boolean
		disableOnUserScroll: boolean
		resumeAfterDelay: number // ms
	}
	timing: {
		typewriterSpeed: number
		fadeInDuration: number
		highlightDuration: number
		completionDisplayTime: number
		staggerDelay: number
	}
}

/**
 * Animation configuration manager for enhanced diff UI.
 * Provides user-customizable animation settings and performance controls.
 */
export class AnimationConfig {
	private static readonly DEFAULT_SETTINGS: AnimationSettings = {
		enabled: true,
		speed: "normal",
		effects: {
			typewriter: true,
			fadeIn: true,
			highlights: true,
			pulseActive: true,
			smoothScrolling: true,
			progressIndicators: true,
		},
		colors: {
			addition: "rgba(46, 160, 67, 0.15)",
			deletion: "rgba(203, 36, 49, 0.15)",
			modification: "rgba(251, 189, 8, 0.15)",
			activeLine: "rgba(255, 215, 0, 0.15)",
			completed: "rgba(46, 160, 67, 0.1)",
			error: "rgba(203, 36, 49, 0.1)",
		},
		autoScroll: {
			enabled: true,
			maxSpeed: 10, // lines per second
			adaptiveSpeed: true,
			disableOnUserScroll: true,
			resumeAfterDelay: 2000, // 2 seconds
		},
		timing: {
			typewriterSpeed: 30,
			fadeInDuration: 300,
			highlightDuration: 500,
			completionDisplayTime: 2000,
			staggerDelay: 100,
		},
	}

	private static currentSettings: AnimationSettings = { ...this.DEFAULT_SETTINGS }

	/**
	 * Load animation settings from VS Code configuration
	 */
	static loadSettings(): AnimationSettings {
		try {
			// Check if VS Code workspace API is available (not in test environment)
			if (!vscode.workspace?.getConfiguration) {
				this.currentSettings = { ...this.DEFAULT_SETTINGS }
				return this.currentSettings
			}

			const config = vscode.workspace.getConfiguration("roo-code.diff.animations")

			const settings: AnimationSettings = {
				enabled: config.get("enabled", this.DEFAULT_SETTINGS.enabled),
				speed: config.get("speed", this.DEFAULT_SETTINGS.speed),
				effects: {
					typewriter: config.get("effects.typewriter", this.DEFAULT_SETTINGS.effects.typewriter),
					fadeIn: config.get("effects.fadeIn", this.DEFAULT_SETTINGS.effects.fadeIn),
					highlights: config.get("effects.highlights", this.DEFAULT_SETTINGS.effects.highlights),
					pulseActive: config.get("effects.pulseActive", this.DEFAULT_SETTINGS.effects.pulseActive),
					smoothScrolling: config.get(
						"effects.smoothScrolling",
						this.DEFAULT_SETTINGS.effects.smoothScrolling,
					),
					progressIndicators: config.get(
						"effects.progressIndicators",
						this.DEFAULT_SETTINGS.effects.progressIndicators,
					),
				},
				colors: {
					addition: config.get("colors.addition", this.DEFAULT_SETTINGS.colors.addition),
					deletion: config.get("colors.deletion", this.DEFAULT_SETTINGS.colors.deletion),
					modification: config.get("colors.modification", this.DEFAULT_SETTINGS.colors.modification),
					activeLine: config.get("colors.activeLine", this.DEFAULT_SETTINGS.colors.activeLine),
					completed: config.get("colors.completed", this.DEFAULT_SETTINGS.colors.completed),
					error: config.get("colors.error", this.DEFAULT_SETTINGS.colors.error),
				},
				timing: this.calculateTimingFromSpeed(config.get("speed", this.DEFAULT_SETTINGS.speed)),
				autoScroll: {
					enabled: config.get("autoScroll.enabled", this.DEFAULT_SETTINGS.autoScroll.enabled),
					maxSpeed: config.get("autoScroll.maxSpeed", this.DEFAULT_SETTINGS.autoScroll.maxSpeed),
					adaptiveSpeed: config.get(
						"autoScroll.adaptiveSpeed",
						this.DEFAULT_SETTINGS.autoScroll.adaptiveSpeed,
					),
					disableOnUserScroll: config.get(
						"autoScroll.disableOnUserScroll",
						this.DEFAULT_SETTINGS.autoScroll.disableOnUserScroll,
					),
					resumeAfterDelay: config.get(
						"autoScroll.resumeAfterDelay",
						this.DEFAULT_SETTINGS.autoScroll.resumeAfterDelay,
					),
				},
			}

			this.currentSettings = settings
			return settings
		} catch (error) {
			// Fallback to default settings in case of any error (e.g., test environment)
			this.currentSettings = { ...this.DEFAULT_SETTINGS }
			return this.currentSettings
		}
	}

	/**
	 * Get current animation settings
	 */
	static getSettings(): AnimationSettings {
		return { ...this.currentSettings }
	}

	/**
	 * Update animation settings
	 */
	static updateSettings(newSettings: Partial<AnimationSettings>): void {
		this.currentSettings = {
			...this.currentSettings,
			...newSettings,
		}
	}

	/**
	 * Check if animations are enabled
	 */
	static isEnabled(): boolean {
		return this.currentSettings.enabled
	}

	/**
	 * Check if a specific effect is enabled
	 */
	static isEffectEnabled(effect: keyof AnimationSettings["effects"]): boolean {
		return this.currentSettings.enabled && this.currentSettings.effects[effect]
	}

	/**
	 * Get timing for a specific animation based on speed setting
	 */
	static getTiming(animation: keyof AnimationSettings["timing"]): number {
		return this.currentSettings.timing[animation]
	}

	/**
	 * Get color for a specific decoration type
	 */
	static getColor(type: keyof AnimationSettings["colors"]): string {
		return this.currentSettings.colors[type]
	}

	/**
	 * Calculate timing values based on speed setting
	 */
	private static calculateTimingFromSpeed(speed: AnimationSettings["speed"]): AnimationSettings["timing"] {
		const baseTimings = this.DEFAULT_SETTINGS.timing

		switch (speed) {
			case "slow":
				return {
					typewriterSpeed: baseTimings.typewriterSpeed * 2,
					fadeInDuration: baseTimings.fadeInDuration * 1.5,
					highlightDuration: baseTimings.highlightDuration * 1.5,
					completionDisplayTime: baseTimings.completionDisplayTime * 1.5,
					staggerDelay: baseTimings.staggerDelay * 1.5,
				}
			case "fast":
				return {
					typewriterSpeed: Math.max(baseTimings.typewriterSpeed * 0.5, 10),
					fadeInDuration: baseTimings.fadeInDuration * 0.5,
					highlightDuration: baseTimings.highlightDuration * 0.5,
					completionDisplayTime: baseTimings.completionDisplayTime * 0.5,
					staggerDelay: baseTimings.staggerDelay * 0.5,
				}
			case "instant":
				return {
					typewriterSpeed: 0,
					fadeInDuration: 0,
					highlightDuration: 100,
					completionDisplayTime: 500,
					staggerDelay: 0,
				}
			case "normal":
			default:
				return { ...baseTimings }
		}
	}

	/**
	 * Get theme-aware colors from VS Code
	 */
	static getThemeColors(): AnimationSettings["colors"] {
		try {
			// Try to get VS Code theme colors if available
			const workbench = vscode.workspace.getConfiguration("workbench")
			const colorTheme = workbench.get<string>("colorTheme")

			// For now, return our defaults but this could be enhanced to detect theme
			// and return appropriate colors based on light/dark theme
			return {
				addition: "var(--vscode-diffEditor-insertedTextBackground, rgba(46, 160, 67, 0.15))",
				deletion: "var(--vscode-diffEditor-removedTextBackground, rgba(203, 36, 49, 0.15))",
				modification: "var(--vscode-diffEditor-insertedTextBackground, rgba(251, 189, 8, 0.15))",
				activeLine: "var(--vscode-editor-lineHighlightBackground, rgba(255, 215, 0, 0.15))",
				completed: "var(--vscode-diffEditor-insertedTextBackground, rgba(46, 160, 67, 0.1))",
				error: "var(--vscode-diffEditor-removedTextBackground, rgba(203, 36, 49, 0.1))",
			}
		} catch {
			return this.currentSettings.colors
		}
	}

	/**
	 * Reset to default settings
	 */
	static resetToDefaults(): void {
		this.currentSettings = { ...this.DEFAULT_SETTINGS }
	}

	/**
	 * Save current settings to VS Code configuration
	 */
	static async saveSettings(): Promise<void> {
		try {
			// Check if VS Code workspace API is available (not in test environment)
			if (!vscode.workspace?.getConfiguration) {
				return
			}

			const config = vscode.workspace.getConfiguration("roo-code.diff.animations")

			await config.update("enabled", this.currentSettings.enabled, vscode.ConfigurationTarget.Global)
			await config.update("speed", this.currentSettings.speed, vscode.ConfigurationTarget.Global)

			// Save effects
			for (const [key, value] of Object.entries(this.currentSettings.effects)) {
				await config.update(`effects.${key}`, value, vscode.ConfigurationTarget.Global)
			}

			// Save colors
			for (const [key, value] of Object.entries(this.currentSettings.colors)) {
				await config.update(`colors.${key}`, value, vscode.ConfigurationTarget.Global)
			}
		} catch (error) {
			// Silently fail in test environments
			console.warn("Failed to save animation settings:", error)
		}
	}

	/**
	 * Create performance-optimized settings for low-end devices
	 */
	static getPerformanceSettings(): AnimationSettings {
		return {
			...this.DEFAULT_SETTINGS,
			speed: "fast",
			effects: {
				typewriter: false,
				fadeIn: true,
				highlights: true,
				pulseActive: false,
				smoothScrolling: false,
				progressIndicators: false,
			},
		}
	}

	/**
	 * Create accessibility-friendly settings
	 */
	static getAccessibilitySettings(): AnimationSettings {
		return {
			...this.DEFAULT_SETTINGS,
			speed: "instant",
			effects: {
				typewriter: false,
				fadeIn: false,
				highlights: true,
				pulseActive: false,
				smoothScrolling: false,
				progressIndicators: true,
			},
		}
	}

	/**
	 * Detect system preferences and adjust settings accordingly
	 */
	static applySystemPreferences(): void {
		// Check for reduced motion preference (would need to be detected via system APIs)
		// For now, we'll provide a method that can be called when such preferences are detected
		const reducedMotion = this.shouldReduceMotion()

		if (reducedMotion) {
			this.updateSettings(this.getAccessibilitySettings())
		}
	}

	/**
	 * Check if motion should be reduced (placeholder for system detection)
	 */
	private static shouldReduceMotion(): boolean {
		// This would ideally check system accessibility settings
		// For now, return false as we can't access those in VS Code extensions
		return false
	}

	/**
	 * Get animation configuration schema for settings UI
	 */
	static getConfigurationSchema(): any {
		return {
			type: "object",
			title: "Roo Code Diff Animations",
			properties: {
				"roo-code.diff.animations.enabled": {
					type: "boolean",
					default: true,
					description: "Enable animated diff effects",
				},
				"roo-code.diff.animations.speed": {
					type: "string",
					enum: ["slow", "normal", "fast", "instant"],
					default: "normal",
					description: "Animation speed",
				},
				"roo-code.diff.animations.effects.typewriter": {
					type: "boolean",
					default: true,
					description: "Enable typewriter effect for streaming content",
				},
				"roo-code.diff.animations.effects.fadeIn": {
					type: "boolean",
					default: true,
					description: "Enable fade-in animations",
				},
				"roo-code.diff.animations.effects.highlights": {
					type: "boolean",
					default: true,
					description: "Enable diff highlighting animations",
				},
				"roo-code.diff.animations.effects.pulseActive": {
					type: "boolean",
					default: true,
					description: "Enable pulsing active line effect",
				},
				"roo-code.diff.animations.effects.smoothScrolling": {
					type: "boolean",
					default: true,
					description: "Enable smooth scrolling transitions",
				},
				"roo-code.diff.animations.effects.progressIndicators": {
					type: "boolean",
					default: true,
					description: "Enable progress indicators during streaming",
				},
			},
		}
	}
}
